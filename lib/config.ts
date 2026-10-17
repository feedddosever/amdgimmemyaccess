// Read at call time, not import time, so tests and scripts can change process.env.
export function config() {
  const env = process.env;
  return {
    mock: env.MOCK_LLM === "1",
    baseURL: (env.LLM_BASE_URL ?? "").replace(/\/+$/, ""),
    apiKey: env.LLM_API_KEY ?? "",
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
