import type { FootprintAnalysis, FootprintHotspot, ImpactCategory } from "./types/lca";

const STAGE_COLORS = ["#2C6B45", "#4A9B6F", "#7BC4A0", "#B8E0CC", "#DCF0E6"];

export const INTAKE_FALLBACK = {
  emissionSources: [
    { stage: "Raw Materials", source: "Organic Cotton Farming", quantity: 0.42, unit: "kg", co2e: 1.26 },
    { stage: "Manufacturing", source: "Textile Dyeing & Finishing", quantity: 0.42, unit: "kg", co2e: 0.89 },
    { stage: "Manufacturing", source: "Cut & Sew Assembly", quantity: 0.42, unit: "kg", co2e: 0.34 },
    { stage: "Packaging", source: "Recycled Cardboard Packaging", quantity: 0.08, unit: "kg", co2e: 0.06 },
    { stage: "Transport", source: "Ocean Freight Bangladesh to US", quantity: 13500, unit: "km", co2e: 0.41 },
    { stage: "Transport", source: "Last Mile Trucking", quantity: 800, unit: "km", co2e: 0.18 },
    { stage: "End of Life", source: "Textile Waste to Landfill", quantity: 0.38, unit: "kg", co2e: 0.22 },
  ],
  totalCo2e: 3.36,
  unit: "kg CO2e per 3-pack",
} as const;

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function buildFallbackFootprint(): FootprintAnalysis {
  const { emissionSources, totalCo2e } = INTAKE_FALLBACK;

  const materialsCo2e =
    emissionSources
      .filter((s) => s.stage === "Raw Materials" || s.stage === "Packaging")
      .reduce((sum, s) => sum + s.co2e, 0);
  const manufacturingCo2e = emissionSources
    .filter((s) => s.stage === "Manufacturing")
    .reduce((sum, s) => sum + s.co2e, 0);
  const logisticsCo2e = emissionSources
    .filter((s) => s.stage === "Transport")
    .reduce((sum, s) => sum + s.co2e, 0);
  const endOfLifeCo2e = emissionSources
    .filter((s) => s.stage === "End of Life")
    .reduce((sum, s) => sum + s.co2e, 0);

  const climateStages = [
    { name: "Materials", value: materialsCo2e, pct: pct(materialsCo2e, totalCo2e), color: STAGE_COLORS[0], source: "estimated" as const },
    { name: "Manufacturing", value: manufacturingCo2e, pct: pct(manufacturingCo2e, totalCo2e), color: STAGE_COLORS[1], source: "estimated" as const },
    { name: "Logistics", value: logisticsCo2e, pct: pct(logisticsCo2e, totalCo2e), color: STAGE_COLORS[2], source: "estimated" as const },
    { name: "Consumer Use", value: 0, pct: 0, color: STAGE_COLORS[3], source: "estimated" as const },
    { name: "End of Life", value: endOfLifeCo2e, pct: pct(endOfLifeCo2e, totalCo2e), color: STAGE_COLORS[4], source: "estimated" as const },
  ];

  const scale = totalCo2e / 3240;

  const scaledCategories: ImpactCategory[] = [
    {
      id: "climate",
      label: "Climate change",
      total: totalCo2e,
      unit: "kg CO₂e",
      vsIndustry: "-18%",
      vsIndustryGood: true,
      topHotspot: "Materials",
      topHotspotPct: pct(materialsCo2e, totalCo2e),
      stages: climateStages,
      source: "estimated",
    },
    {
      id: "water",
      label: "Water deprivation",
      total: Math.round(8420 * scale * 100) / 100,
      unit: "m³ world eq.",
      vsIndustry: "+12%",
      vsIndustryGood: false,
      topHotspot: "Materials",
      topHotspotPct: 70,
      stages: climateStages.map((s, i) => ({
        ...s,
        value: Math.round(8420 * scale * (s.pct / 100) * 100) / 100,
        color: STAGE_COLORS[i],
      })),
      source: "estimated",
    },
    {
      id: "energy",
      label: "Energy demand",
      total: Math.round(148 * scale * 100) / 100,
      unit: "MJ",
      vsIndustry: "-9%",
      vsIndustryGood: true,
      topHotspot: "Manufacturing",
      topHotspotPct: 39,
      renewableTotal: Math.round(42 * scale * 100) / 100,
      nonRenewableTotal: Math.round(106 * scale * 100) / 100,
      stages: climateStages.map((s, i) => ({
        ...s,
        value: Math.round(148 * scale * (s.pct / 100) * 100) / 100,
        renewable: Math.round(42 * scale * (s.pct / 100) * 100) / 100,
        nonRenewable: Math.round(106 * scale * (s.pct / 100) * 100) / 100,
        color: STAGE_COLORS[i],
      })),
      source: "estimated",
    },
    {
      id: "eutrophication",
      label: "Eutrophication",
      total: Math.round(2.8 * scale * 1000) / 1000,
      unit: "kg PO₄³⁻ eq.",
      vsIndustry: "+8%",
      vsIndustryGood: false,
      topHotspot: "Materials",
      topHotspotPct: 54,
      stages: climateStages.map((s, i) => ({
        ...s,
        value: Math.round(2.8 * scale * (s.pct / 100) * 1000) / 1000,
        color: STAGE_COLORS[i],
      })),
      source: "estimated",
    },
    {
      id: "acidification",
      label: "Acidification",
      total: Math.round(18.6 * scale * 100) / 100,
      unit: "kg SO₂ eq.",
      vsIndustry: "-14%",
      vsIndustryGood: true,
      topHotspot: "Manufacturing",
      topHotspotPct: 43,
      stages: climateStages.map((s, i) => ({
        ...s,
        value: Math.round(18.6 * scale * (s.pct / 100) * 100) / 100,
        color: STAGE_COLORS[i],
      })),
      source: "estimated",
    },
    {
      id: "toxicity",
      label: "Human toxicity",
      total: Math.round(12.4 * scale * 100) / 100,
      unit: "CTUh",
      vsIndustry: "-22%",
      vsIndustryGood: true,
      topHotspot: "Materials",
      topHotspotPct: 58,
      stages: climateStages.map((s, i) => ({
        ...s,
        value: Math.round(12.4 * scale * (s.pct / 100) * 100) / 100,
        color: STAGE_COLORS[i],
      })),
      source: "estimated",
    },
  ];

  const hotspots: FootprintHotspot[] = [
    {
      id: "materials",
      badge: "Materials",
      badgeColor: "green",
      title: "Organic Cotton Farming",
      impacts: {
        climate: `${materialsCo2e.toFixed(2)} kg CO₂e · ${pct(materialsCo2e, totalCo2e)}% of total`,
        water: `${(8420 * scale * 0.7).toFixed(2)} m³ world eq. · 70% of total`,
        energy: `${(148 * scale * 0.35).toFixed(2)} MJ · 35% of total`,
        eutrophication: `${(2.8 * scale * 0.54).toFixed(2)} kg PO₄³⁻ eq. · 54% of total`,
        acidification: `${(18.6 * scale * 0.35).toFixed(2)} kg SO₂ eq. · 35% of total`,
        toxicity: `${(12.4 * scale * 0.58).toFixed(2)} CTUh · 58% of total`,
      },
      note: "Cotton farming drives water and toxicity.",
      source: "estimated",
    },
    {
      id: "manufacturing",
      badge: "Manufacturing",
      badgeColor: "amber",
      title: "Textile dyeing & cut/sew",
      impacts: {
        climate: `${manufacturingCo2e.toFixed(2)} kg CO₂e · ${pct(manufacturingCo2e, totalCo2e)}% of total`,
        water: `${(8420 * scale * 0.2).toFixed(2)} m³ world eq. · 20% of total`,
        energy: `${(148 * scale * 0.39).toFixed(2)} MJ · 39% of total`,
        eutrophication: `${(2.8 * scale * 0.31).toFixed(2)} kg PO₄³⁻ eq. · 31% of total`,
        acidification: `${(18.6 * scale * 0.43).toFixed(2)} kg SO₂ eq. · 43% of total`,
        toxicity: `${(12.4 * scale * 0.25).toFixed(2)} CTUh · 25% of total`,
      },
      note: "Dyeing and assembly drive energy and acidification.",
      source: "estimated",
    },
    {
      id: "logistics",
      badge: "Logistics",
      badgeColor: "blue",
      title: "Ocean freight + last mile",
      impacts: {
        climate: `${logisticsCo2e.toFixed(2)} kg CO₂e · ${pct(logisticsCo2e, totalCo2e)}% of total`,
        water: `${(8420 * scale * 0.06).toFixed(2)} m³ world eq. · 6% of total`,
        energy: `${(148 * scale * 0.19).toFixed(2)} MJ · 19% of total`,
        eutrophication: `${(2.8 * scale * 0.08).toFixed(2)} kg PO₄³⁻ eq. · 8% of total`,
        acidification: `${(18.6 * scale * 0.13).toFixed(2)} kg SO₂ eq. · 13% of total`,
        toxicity: `${(12.4 * scale * 0.1).toFixed(2)} CTUh · 10% of total`,
      },
      note: "Sea freight and trucking are the main logistics drivers.",
      source: "estimated",
    },
  ];

  return {
    impactCategories: scaledCategories,
    hotspots,
    dataAccuracy: 74,
    verifiedCount: 5,
    estimatedCount: 2,
    totalCo2e,
  };
}

export const INTAKE_API_TIMEOUT_MS = 10_000;
