import { callClaudeJson } from "./anthropic.server";
import { computeCo2eTotal, searchClimatiq } from "./climatiq.server";
import type {
  EmissionSourceDraft,
  FootprintAnalysis,
  FootprintHotspot,
  ImpactCategory,
  IntakeInput,
  LcaPipelineResult,
  PlayRecommendation,
  ProductClassification,
  ResolvedEmissionFactor,
  ScenarioResult,
} from "./types/lca";

const STAGE_COLORS = ["#2C6B45", "#4A9B6F", "#7BC4A0", "#B8E0CC", "#DCF0E6"];

function withStageColors(categories: ImpactCategory[]): ImpactCategory[] {
  return categories.map((category) => ({
    ...category,
    stages: category.stages.map((stage, index) => ({
      ...stage,
      color: stage.color ?? STAGE_COLORS[index % STAGE_COLORS.length],
    })),
  }));
}

function buildClassificationPrompt(input: IntakeInput): string {
  return `You are an LCA expert. Based on this product description, identify the top 5-8 emission sources across the product lifecycle.

Product name: ${input.productName}
Category: ${input.category}
Lifecycle boundary: ${input.boundary}
Goals: ${input.goals.join("; ")}
Description: ${input.productDescription ?? "Not provided"}
Materials/processes provided: ${input.materialsAndProcesses ?? "Not provided"}

Return JSON with this exact shape:
{
  "industryCategory": "string",
  "manufacturingProcesses": ["string"],
  "materials": [{ "name": "string", "quantity": number, "unit": "string" }],
  "lifecycleHotspots": ["string"],
  "emissionSources": [
    {
      "name": "string",
      "lifecycleStage": "Materials|Manufacturing|Logistics|Consumer Use|End of Life",
      "climatiqSearchTerm": "string",
      "quantity": number,
      "unit": "string",
      "notes": "string"
    }
  ]
}

For each emission source, suggest the most appropriate Climatiq emission factor search term, the lifecycle stage, and an estimated quantity with unit.`;
}

export async function classifyProduct(input: IntakeInput): Promise<ProductClassification> {
  return callClaudeJson<ProductClassification>(buildClassificationPrompt(input));
}

async function suggestFallbackSearchTerm(source: EmissionSourceDraft): Promise<string> {
  const result = await callClaudeJson<{ fallbackSearchTerm: string }>(
    `Climatiq returned no emission factors for the search term "${source.climatiqSearchTerm}" for ${source.name} (${source.lifecycleStage}).

Suggest one simpler, broader Climatiq search term that is more likely to match an emission factor database entry.

Return JSON: { "fallbackSearchTerm": "string" }`,
    512,
  );
  return result.fallbackSearchTerm;
}

export async function resolveEmissionFactors(
  sources: EmissionSourceDraft[],
): Promise<ResolvedEmissionFactor[]> {
  const resolved: ResolvedEmissionFactor[] = [];

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

      const estimate = await callClaudeJson<{ co2eFactor: number; co2eTotal: number }>(
        `Estimate a plausible kg CO2e factor and total for this emission source when no Climatiq factor was found.
Source: ${JSON.stringify(source)}

Return JSON: { "co2eFactor": number, "co2eTotal": number }`,
        512,
      );

      resolved.push({
        ...source,
        co2eFactor: estimate.co2eFactor,
        co2eTotal: estimate.co2eTotal,
        source: "ai_estimated",
      });
    } catch {
      const estimate = await callClaudeJson<{ co2eFactor: number; co2eTotal: number }>(
        `Estimate a plausible kg CO2e factor and total for this emission source when Climatiq lookup failed.
Source: ${JSON.stringify(source)}

Return JSON: { "co2eFactor": number, "co2eTotal": number }`,
        512,
      );

      resolved.push({
        ...source,
        co2eFactor: estimate.co2eFactor,
        co2eTotal: estimate.co2eTotal,
        source: "ai_estimated",
      });
    }
  }

  return resolved;
}

export async function analyzeFootprint(
  input: IntakeInput,
  classification: ProductClassification,
  emissionFactors: ResolvedEmissionFactor[],
): Promise<FootprintAnalysis> {
  const footprint = await callClaudeJson<FootprintAnalysis>(
    `You are an LCA expert. Using the product details, resolved emission factors, and quantities below, calculate the footprint dashboard data.

Product: ${JSON.stringify(input)}
Classification: ${JSON.stringify(classification)}
Emission factors: ${JSON.stringify(emissionFactors)}

Tasks:
1. Calculate total CO2e per lifecycle stage from verified factors where available.
2. Identify the top 3 hotspots.
3. Score each impact category: climate change (GWP), water deprivation, energy demand (include renewableTotal and nonRenewableTotal in MJ), eutrophication, acidification, human toxicity.
4. Estimate non-GWP categories based on product type since Climatiq primarily returns CO2e.
5. Mark each category and hotspot source as "verified" if mostly based on Climatiq factors, otherwise "ai_estimated".

Return JSON:
{
  "impactCategories": [
    {
      "id": "climate|water|energy|eutrophication|acidification|toxicity",
      "label": "string",
      "total": number,
      "unit": "string",
      "vsIndustry": "string like -18%",
      "vsIndustryGood": boolean,
      "topHotspot": "string",
      "topHotspotPct": number,
      "renewableTotal": number,
      "nonRenewableTotal": number,
      "source": "verified|ai_estimated",
      "stages": [
        { "name": "Materials|Manufacturing|Logistics|Consumer Use|End of Life", "value": number, "pct": number, "renewable": number, "nonRenewable": number, "source": "verified|ai_estimated" }
      ]
    }
  ],
  "hotspots": [
    {
      "id": "materials|manufacturing|logistics",
      "badge": "Materials|Manufacturing|Logistics",
      "badgeColor": "green|amber|blue",
      "title": "string",
      "note": "string",
      "source": "verified|ai_estimated",
      "impacts": {
        "climate": "string",
        "water": "string",
        "energy": "string",
        "eutrophication": "string",
        "acidification": "string",
        "toxicity": "string"
      }
    }
  ],
  "dataAccuracy": number,
  "verifiedCount": number,
  "estimatedCount": number,
  "totalCo2e": number
}`,
    6000,
  );

  return {
    ...footprint,
    impactCategories: withStageColors(footprint.impactCategories),
  };
}

export async function runIntakePipeline(input: IntakeInput): Promise<LcaPipelineResult> {
  const classification = await classifyProduct(input);
  const emissionFactors = await resolveEmissionFactors(classification.emissionSources);
  const footprint = await analyzeFootprint(input, classification, emissionFactors);
  return { classification, emissionFactors, footprint };
}

export async function generateRecommendations(
  input: IntakeInput,
  footprint: FootprintAnalysis,
): Promise<PlayRecommendation[]> {
  const plays = await callClaudeJson<{ plays: PlayRecommendation[] }>(
    `You are a sustainability strategist. Based on the product and footprint hotspots below, suggest 3-5 specific interventions.

Product: ${JSON.stringify(input)}
Hotspots: ${JSON.stringify(footprint.hotspots)}
Impact categories: ${JSON.stringify(footprint.impactCategories)}

Keep play text to one concise sentence (about 8–14 words). For each intervention estimate:
- stage: Materials|Manufacturing|Logistics
- play: short intervention label
- co2: kg CO2e savings (negative number for reductions)
- cost: USD per unit impact (negative = savings)
- owner: short owner role (1-2 words)
- effort: Low|Med|High
- star: true if it saves both carbon and money
- impactScores: object with estimated reduction per category (climate, water, energy, eutrophication, acidification, toxicity) — negative = improvement

Return JSON: { "plays": [ ... ] }`,
    4096,
  );

  return plays.plays.map((play, index) => ({
    ...play,
    id: play.id ?? `p${index + 1}`,
    source: play.source ?? "ai_estimated",
  }));
}

export async function modelScenario(input: {
  product: IntakeInput;
  footprint: FootprintAnalysis;
  intervention: string;
  changeType: string;
  stage: string;
  volume: number;
  carbonPricePerTonne?: number;
  baselineUnitCostUsd?: number;
}): Promise<ScenarioResult> {
  const carbonPrice = input.carbonPricePerTonne ?? 65;
  const baselineUnitCost = input.baselineUnitCostUsd ?? 4.62;

  const scenario = await callClaudeJson<ScenarioResult>(
    `You are an LCA scenario modeler. Recalculate the footprint and unit cost with the chosen intervention applied.

Product: ${JSON.stringify(input.product)}
Current footprint: ${JSON.stringify(input.footprint)}
Intervention: ${input.intervention}
Change type: ${input.changeType}
Lifecycle stage: ${input.stage}
Annual volume: ${input.volume}
Carbon price: $${carbonPrice}/tonne CO2e
Baseline unit cost (FOB / 3-pack): $${baselineUnitCost}

Return JSON:
{
  "intervention": "string",
  "source": "verified|ai_estimated",
  "impactCategories": [
    { "id": "climate|water|energy|eutrophication|acidification|toxicity", "label": "string", "before": number, "after": number, "unit": "string", "source": "verified|ai_estimated" }
  ],
  "rows": [
    { "metric": "string", "before": "string", "after": "string", "delta": "string", "improved": boolean, "source": "verified|ai_estimated" }
  ],
  "carbonCostSavingsUsd": number,
  "annualCo2ReductionKg": number,
  "annualCostSavingUsd": number
}

Required comparison rows (include all):
- Material or total CO2e impact
- Total footprint
- Material cost / 3-pack (before baseline $${baselineUnitCost}, after scenario)
- Annual CO2 reduction at stated volume
- Carbon cost savings at $${carbonPrice}/tonne CO2e
- Annual cost impact (unit cost delta × volume; positive = savings)`,
    4096,
  );

  return scenario;
}

export type { FootprintHotspot, ImpactCategory };
