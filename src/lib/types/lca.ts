export type DataSource = "verified" | "ai_estimated" | "estimated";

export type LifecycleBoundary = "cradle-to-gate" | "cradle-to-grave" | "gate-to-grave";

export type ImpactStage = {
  name: string;
  value: number;
  pct: number;
  color?: string;
  renewable?: number;
  nonRenewable?: number;
  source?: DataSource;
};

export type ImpactCategory = {
  id: string;
  label: string;
  total: number;
  unit: string;
  vsIndustry: string;
  vsIndustryGood: boolean;
  topHotspot: string;
  topHotspotPct: number;
  stages: ImpactStage[];
  renewableTotal?: number;
  nonRenewableTotal?: number;
  source?: DataSource;
};

export type FootprintHotspot = {
  id: string;
  badge: string;
  badgeColor: "green" | "amber" | "blue";
  title: string;
  note: string;
  impacts: Record<string, string>;
  source?: DataSource;
};

export type EmissionSourceDraft = {
  name: string;
  lifecycleStage: string;
  climatiqSearchTerm: string;
  quantity: number;
  unit: string;
  notes?: string;
};

export type ResolvedEmissionFactor = EmissionSourceDraft & {
  activityId?: string;
  factorId?: string;
  factorName?: string;
  factorUnit?: string;
  co2eFactor?: number;
  co2eTotal?: number;
  source: DataSource;
};

export type ProductClassification = {
  industryCategory: string;
  manufacturingProcesses: string[];
  materials: { name: string; quantity?: number; unit?: string }[];
  emissionSources: EmissionSourceDraft[];
  lifecycleHotspots: string[];
};

export type FootprintAnalysis = {
  impactCategories: ImpactCategory[];
  hotspots: FootprintHotspot[];
  dataAccuracy: number;
  verifiedCount: number;
  estimatedCount: number;
  totalCo2e: number;
};

export type PlayRecommendation = {
  id: string;
  stage: "Materials" | "Manufacturing" | "Logistics";
  play: string;
  co2: number;
  cost: number;
  owner: string;
  effort: "Low" | "Med" | "High";
  star?: boolean;
  pillar?: string;
  supplier?: string;
  emissionsReductionPct?: number;
  costImpact?: "increase" | "decrease" | "neutral";
  impactScores?: Partial<Record<string, number>>;
  source?: DataSource;
};

export type ScenarioComparisonRow = {
  metric: string;
  before: string;
  after: string;
  delta: string;
  improved: boolean;
  source?: DataSource;
};

export type ScenarioResult = {
  intervention: string;
  rows: ScenarioComparisonRow[];
  impactCategories: { id: string; label: string; before: number; after: number; unit: string; source?: DataSource }[];
  carbonCostSavingsUsd: number;
  annualCo2ReductionKg?: number;
  annualCostSavingUsd?: number;
  source?: DataSource;
};

export type IntakeInput = {
  productName: string;
  productDescription?: string;
  materialsAndProcesses?: string;
  category: string;
  boundary: LifecycleBoundary;
  goals: string[];
};

export type LcaPipelineResult = {
  classification: ProductClassification;
  emissionFactors: ResolvedEmissionFactor[];
  footprint: FootprintAnalysis;
};
