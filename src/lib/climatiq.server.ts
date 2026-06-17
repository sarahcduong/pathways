import { getServerConfig } from "./config.server";

const CLIMATIQ_BASE = "https://beta3.api.climatiq.io";

export type ClimatiqSearchHit = {
  id: string;
  activity_id: string;
  name: string;
  unit: string;
  unit_type?: string;
  factor: number;
  region?: string;
  source?: string;
  sector?: string;
  category?: string;
};

type ClimatiqSearchResponse = {
  results?: ClimatiqSearchHit[];
  total_results?: number;
};

export async function searchClimatiq(query: string): Promise<ClimatiqSearchHit | null> {
  const { climatiqApiKey } = getServerConfig();
  if (!climatiqApiKey) {
    throw new Error("CLIMATIQ_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    query,
    data_version: "^21",
    results_per_page: "5",
  });

  const response = await fetch(`${CLIMATIQ_BASE}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${climatiqApiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Climatiq search error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as ClimatiqSearchResponse;
  return data.results?.[0] ?? null;
}

export function computeCo2eTotal(factor: number, quantity: number): number {
  return factor * quantity;
}
