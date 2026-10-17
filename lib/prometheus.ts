// Minimal reader for the Prometheus text format that vLLM serves at /metrics.

// Sums every sample of each metric name across its label sets (engines, models).
export function parsePrometheus(text: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{.*\})?\s+(\S+)/);
    if (!match) continue;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) continue;
    totals.set(match[1], (totals.get(match[1]) ?? 0) + value);
  }
  return totals;
}

// Metric names differ between vLLM versions, so match by substring, in order of preference.
export function pickMetric(totals: Map<string, number>, substrings: string[]): number | null {
  for (const substring of substrings) {
    for (const [name, value] of totals) {
      if (name.includes(substring)) return value;
    }
  }
  return null;
}

export type ServerMetrics = {
  status: "live" | "offline" | "mock";
  running: number | null;
  waiting: number | null;
  // Fraction of the KV cache in use, 0–1.
  kvCacheUsage: number | null;
  promptTokensTotal: number | null;
  generationTokensTotal: number | null;
};

export function readVllmMetrics(text: string): Omit<ServerMetrics, "status"> {
  const totals = parsePrometheus(text);
  return {
    running: pickMetric(totals, ["num_requests_running"]),
    waiting: pickMetric(totals, ["num_requests_waiting"]),
    kvCacheUsage: pickMetric(totals, ["kv_cache_usage_perc", "gpu_cache_usage_perc", "cache_usage"]),
    promptTokensTotal: pickMetric(totals, ["prompt_tokens_total"]),
    generationTokensTotal: pickMetric(totals, ["generation_tokens_total"]),
  };
}
