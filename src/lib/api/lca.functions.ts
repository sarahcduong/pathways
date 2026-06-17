import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  analyzeFootprint,
  classifyProduct,
  generateRecommendations,
  modelScenario,
  resolveEmissionFactors,
  runIntakePipeline,
} from "../lca-pipeline.server";

const intakeSchema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().optional(),
  materialsAndProcesses: z.string().optional(),
  category: z.string().min(1),
  boundary: z.enum(["cradle-to-gate", "cradle-to-grave", "gate-to-grave"]),
  goals: z.array(z.string()).min(1),
});

const footprintSchema = z.object({
  impactCategories: z.array(z.any()),
  hotspots: z.array(z.any()),
  dataAccuracy: z.number(),
  verifiedCount: z.number(),
  estimatedCount: z.number(),
  totalCo2e: z.number(),
});

export const runProductIntake = createServerFn({ method: "POST" })
  .validator(intakeSchema)
  .handler(async ({ data }) => runIntakePipeline(data));

export const classifyProductOnly = createServerFn({ method: "POST" })
  .validator(intakeSchema)
  .handler(async ({ data }) => classifyProduct(data));

export const fetchEmissionFactors = createServerFn({ method: "POST" })
  .validator(
    z.object({
      emissionSources: z.array(
        z.object({
          name: z.string(),
          lifecycleStage: z.string(),
          climatiqSearchTerm: z.string(),
          quantity: z.number(),
          unit: z.string(),
          notes: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => resolveEmissionFactors(data.emissionSources));

export const analyzeProductFootprint = createServerFn({ method: "POST" })
  .validator(
    z.object({
      intake: intakeSchema,
      classification: z.any(),
      emissionFactors: z.array(z.any()),
    }),
  )
  .handler(async ({ data }) =>
    analyzeFootprint(data.intake, data.classification, data.emissionFactors),
  );

export const getActionRecommendations = createServerFn({ method: "POST" })
  .validator(
    z.object({
      intake: intakeSchema,
      footprint: footprintSchema,
    }),
  )
  .handler(async ({ data }) => generateRecommendations(data.intake, data.footprint));

export const calculateScenario = createServerFn({ method: "POST" })
  .validator(
    z.object({
      intake: intakeSchema,
      footprint: footprintSchema,
      intervention: z.string().min(1),
      changeType: z.string().min(1),
      stage: z.string().min(1),
      volume: z.number().min(1),
      carbonPricePerTonne: z.number().optional(),
      baselineUnitCostUsd: z.number().optional(),
    }),
  )
  .handler(async ({ data }) =>
    modelScenario({
      product: data.intake,
      footprint: data.footprint,
      intervention: data.intervention,
      changeType: data.changeType,
      stage: data.stage,
      volume: data.volume,
      carbonPricePerTonne: data.carbonPricePerTonne,
      baselineUnitCostUsd: data.baselineUnitCostUsd,
    }),
  );
