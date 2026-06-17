const STAGE_COLORS = ["#2C6B45", "#4A9B6F", "#7BC4A0", "#B8E0CC", "#DCF0E6"];

export function withStageColors(categories) {
  return categories.map((category) => ({
    ...category,
    stages: category.stages.map((stage, index) => ({
      ...stage,
      color: stage.color ?? STAGE_COLORS[index % STAGE_COLORS.length],
    })),
  }));
}

export function buildClassificationPrompt(input) {
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

export function buildFootprintPrompt(input, classification, emissionFactors) {
  return `You are an LCA expert. Using the product details, resolved emission factors, and quantities below, calculate the footprint dashboard data.

Product: ${JSON.stringify(input)}
Classification: ${JSON.stringify(classification)}
Emission factors: ${JSON.stringify(emissionFactors)}

Tasks:
1. Calculate total CO2e per lifecycle stage from verified factors where available.
2. Identify the top 3 hotspots.
3. Score each impact category: climate change (GWP), water deprivation, energy demand (include renewableTotal and nonRenewableTotal in MJ), eutrophication, acidification, human toxicity.
4. Estimate non-GWP categories based on product type since Climatiq primarily returns CO2e.
5. Mark each category and hotspot source as "verified" if mostly based on Climatiq factors, otherwise "ai_estimated".
6. Hotspot notes must be short (about half the length of a typical paragraph · one sentence, ≤12 words).

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
      "note": "string · max 12 words, one crisp insight, no preamble",
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
}`;
}

export function buildRecommendationsPrompt(input, footprint) {
  return `You are a sustainability strategist. Based on the product and footprint hotspots below, suggest 3-5 specific interventions.

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
- impactScores: object with estimated reduction per category (climate, water, energy, eutrophication, acidification, toxicity) · negative = improvement

Return JSON: { "plays": [ ... ] }`;
}

export function buildScenarioPrompt(input) {
  const carbonPrice = input.carbonPricePerTonne ?? 65;
  const baselineUnitCost = input.baselineUnitCostUsd ?? 4.62;

  return `You are an LCA scenario modeler. Recalculate the footprint and unit cost with the chosen intervention applied.

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
- Annual cost impact (unit cost delta × volume; positive = savings)`;
}
