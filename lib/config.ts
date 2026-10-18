// Read at call time, not import time, so tests and scripts can change process.env.
export function config() {
  const env = process.env;
  return {
    mock: env.MOCK_LLM === "1",
    baseURL: (env.LLM_BASE_URL ?? "").replace(/\/+$/, ""),
    apiKey: apiKey(env.LLM_API_KEY),
    model: env.LLM_MODEL || "google/gemma-4-26B-A4B-it",
    metricsURL: env.LLM_METRICS_URL ?? "",
    gpuHourlyUsd: positiveNumber(env.GPU_HOURLY_USD),
    eurPerUsd: positiveNumber(env.EUR_PER_USD),
    benchTokensPerSec: positiveNumber(env.BENCH_TOKENS_PER_SEC),
  };
}

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Token Factory keys start with a lowercase "rc-"; phone keyboards often capitalise the
// first letter when a key is pasted into a settings form, and the gateway then rejects it.
export function apiKey(value: string | undefined): string {
  return (value ?? "").trim().replace(/^rc-/i, "rc-");
}
