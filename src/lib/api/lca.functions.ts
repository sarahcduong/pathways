import { postNetlifyFunction } from "./netlify-client";
import type {
  EmissionSourceDraft,
  FootprintAnalysis,
  IntakeInput,
  LcaPipelineResult,
  PlayRecommendation,
  ProductClassification,
  ResolvedEmissionFactor,
  ScenarioResult,
} from "../types/lca";

export async function runProductIntake({ data }: { data: IntakeInput }): Promise<LcaPipelineResult> {
  const classification = await postNetlifyFunction<ProductClassification>("classify-product", data);

  const emissionFactors = await postNetlifyFunction<ResolvedEmissionFactor[]>(
    "get-emission-factors",
    { emissionSources: classification.emissionSources },
  );

  const footprint = await postNetlifyFunction<FootprintAnalysis>("classify-product", {
    task: "analyzeFootprint",
    intake: data,
    classification,
    emissionFactors,
  });

  return { classification, emissionFactors, footprint };
}

export async function classifyProductOnly({ data }: { data: IntakeInput }): Promise<ProductClassification> {
  return postNetlifyFunction<ProductClassification>("classify-product", data);
}

export async function fetchEmissionFactors({
  data,
}: {
  data: { emissionSources: EmissionSourceDraft[] };
}): Promise<ResolvedEmissionFactor[]> {
  return postNetlifyFunction<ResolvedEmissionFactor[]>("get-emission-factors", data);
}

export async function analyzeProductFootprint({
  data,
}: {
  data: {
    intake: IntakeInput;
    classification: ProductClassification;
    emissionFactors: ResolvedEmissionFactor[];
  };
}): Promise<FootprintAnalysis> {
  return postNetlifyFunction<FootprintAnalysis>("classify-product", {
    task: "analyzeFootprint",
    ...data,
  });
}

export async function getActionRecommendations({
  data,
}: {
  data: { intake: IntakeInput; footprint: FootprintAnalysis };
}): Promise<PlayRecommendation[]> {
  return postNetlifyFunction<PlayRecommendation[]>("classify-product", {
    task: "recommendations",
    intake: data.intake,
    footprint: data.footprint,
  });
}

export async function calculateScenario({
  data,
}: {
  data: {
    intake: IntakeInput;
    footprint: FootprintAnalysis;
    intervention: string;
    changeType: string;
    stage: string;
    volume: number;
    carbonPricePerTonne?: number;
    baselineUnitCostUsd?: number;
  };
}): Promise<ScenarioResult> {
  return postNetlifyFunction<ScenarioResult>("classify-product", {
    task: "scenario",
    intake: data.intake,
    footprint: data.footprint,
    intervention: data.intervention,
    changeType: data.changeType,
    stage: data.stage,
    volume: data.volume,
    carbonPricePerTonne: data.carbonPricePerTonne,
    baselineUnitCostUsd: data.baselineUnitCostUsd,
  });
}
