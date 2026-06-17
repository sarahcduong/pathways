import { callClaudeJson } from "../lib/claude.js";
import {
  buildClassificationPrompt,
  buildFootprintPrompt,
  buildRecommendationsPrompt,
  buildScenarioPrompt,
  withStageColors,
} from "../lib/prompts.js";
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from "../lib/http.js";

export default async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJsonBody(request);
    const task = body.task ?? "classify";

    if (task === "classify") {
      if (!body.productName || !body.category || !body.boundary || !body.goals?.length) {
        return errorResponse("productName, category, boundary, and goals are required", 400);
      }

      const classification = await callClaudeJson(buildClassificationPrompt(body));
      return jsonResponse(classification);
    }

    if (task === "analyzeFootprint") {
      const { intake, classification, emissionFactors } = body;
      if (!intake || !classification || !emissionFactors) {
        return errorResponse("intake, classification, and emissionFactors are required", 400);
      }

      const footprint = await callClaudeJson(
        buildFootprintPrompt(intake, classification, emissionFactors),
        6000,
      );
      return jsonResponse({
        ...footprint,
        impactCategories: withStageColors(footprint.impactCategories),
      });
    }

    if (task === "recommendations") {
      const { intake, footprint } = body;
      if (!intake || !footprint) {
        return errorResponse("intake and footprint are required", 400);
      }

      const result = await callClaudeJson(buildRecommendationsPrompt(intake, footprint));
      const plays = (result.plays ?? []).map((play, index) => ({
        ...play,
        id: play.id ?? `p${index + 1}`,
        source: play.source ?? "ai_estimated",
      }));
      return jsonResponse(plays);
    }

    if (task === "scenario") {
      const { intake, footprint, intervention, changeType, stage, volume } = body;
      if (!intake || !footprint || !intervention || !changeType || !stage || volume == null) {
        return errorResponse(
          "intake, footprint, intervention, changeType, stage, and volume are required",
          400,
        );
      }

      const scenario = await callClaudeJson(
        buildScenarioPrompt({
          product: intake,
          footprint,
          intervention,
          changeType,
          stage,
          volume,
          carbonPricePerTonne: body.carbonPricePerTonne,
          baselineUnitCostUsd: body.baselineUnitCostUsd,
        }),
      );
      return jsonResponse(scenario);
    }

    return errorResponse(`Unknown task: ${task}`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Classification failed";
    return errorResponse(message);
  }
};
