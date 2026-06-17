import { callClaudeJson } from "../lib/claude.js";
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from "../lib/http.js";

const CLIMATIQ_BASE = "https://beta3.api.climatiq.io";

async function searchClimatiq(query) {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  if (!apiKey) {
    throw new Error("CLIMATIQ_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    query,
    data_version: "^21",
    results_per_page: "5",
  });

  const response = await fetch(`${CLIMATIQ_BASE}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Climatiq search error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.results?.[0] ?? null;
}

function computeCo2eTotal(factor, quantity) {
  return factor * quantity;
}

async function suggestFallbackSearchTerm(source) {
  const result = await callClaudeJson(
    `Climatiq returned no emission factors for the search term "${source.climatiqSearchTerm}" for ${source.name} (${source.lifecycleStage}).

Suggest one simpler, broader Climatiq search term that is more likely to match an emission factor database entry.

Return JSON: { "fallbackSearchTerm": "string" }`,
    512,
  );
  return result.fallbackSearchTerm;
}

async function estimateEmissionSource(source, reason) {
  const estimate = await callClaudeJson(
    `Estimate a plausible kg CO2e factor and total for this emission source when ${reason}.
Source: ${JSON.stringify(source)}

Return JSON: { "co2eFactor": number, "co2eTotal": number }`,
    512,
  );

  return {
    ...source,
    co2eFactor: estimate.co2eFactor,
    co2eTotal: estimate.co2eTotal,
    source: "ai_estimated",
  };
}

async function resolveEmissionFactors(sources) {
  const resolved = [];

  for (const source of sources) {
    try {
      let hit = await searchClimatiq(source.climatiqSearchTerm);

      if (!hit) {
        const fallbackTerm = await suggestFallbackSearchTerm(source);
        hit = await searchClimatiq(fallbackTerm);
      }

      if (hit) {
        resolved.push({
          ...source,
          activityId: hit.activity_id,
          factorId: hit.id,
          factorName: hit.name,
          factorUnit: hit.unit,
          co2eFactor: hit.factor,
          co2eTotal: computeCo2eTotal(hit.factor, source.quantity),
          source: "verified",
        });
        continue;
      }

      resolved.push(await estimateEmissionSource(source, "no Climatiq factor was found"));
    } catch {
      resolved.push(await estimateEmissionSource(source, "Climatiq lookup failed"));
    }
  }

  return resolved;
}

export default async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJsonBody(request);

    if (body.emissionSources?.length) {
      const factors = await resolveEmissionFactors(body.emissionSources);
      return jsonResponse(factors);
    }

    if (body.searchTerms?.length) {
      const results = [];
      for (const term of body.searchTerms) {
        const query = typeof term === "string" ? term : term.query;
        if (!query) continue;
        const hit = await searchClimatiq(query);
        results.push(hit ? { query, ...hit } : { query, result: null });
      }
      return jsonResponse(results);
    }

    if (body.query) {
      const hit = await searchClimatiq(body.query);
      return jsonResponse(hit);
    }

    return errorResponse("Provide emissionSources, searchTerms, or query", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Emission factor lookup failed";
    return errorResponse(message);
  }
};
