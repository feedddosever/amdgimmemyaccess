import { describe, expect, it } from "vitest";
import type { PanelEntry } from "@/lib/panel";
import { summarizeLog } from "@/lib/panel";
import { parsePrometheus, readVllmMetrics } from "@/lib/prometheus";

const VLLM_V1 = `# HELP vllm:num_requests_running Number of requests in model execution batches.
# TYPE vllm:num_requests_running gauge
vllm:num_requests_running{engine="0",model_name="google/gemma-4-26B-A4B-it"} 3.0
vllm:num_requests_waiting{engine="0",model_name="google/gemma-4-26B-A4B-it"} 1.0
vllm:kv_cache_usage_perc{engine="0",model_name="google/gemma-4-26B-A4B-it"} 0.125
# TYPE vllm:prompt_tokens_total counter
vllm:prompt_tokens_total{engine="0",model_name="google/gemma-4-26B-A4B-it"} 120345.0
vllm:generation_tokens_total{engine="0",model_name="google/gemma-4-26B-A4B-it"} 45678.0
vllm:generation_tokens_created{engine="0",model_name="google/gemma-4-26B-A4B-it"} 1.7e+09
vllm:request_generation_tokens_bucket{le="+Inf",model_name="google/gemma-4-26B-A4B-it"} 812.0
vllm:e2e_request_latency_seconds_sum{model_name="google/gemma-4-26B-A4B-it"} NaN
`;

const VLLM_OLD = `vllm:num_requests_running{model_name="m"} 2
vllm:num_requests_waiting{model_name="m"} 0
vllm:gpu_cache_usage_perc{model_name="m"} 0.5
vllm:generation_tokens_total{model_name="m"} 10
`;

describe("vLLM metrics", () => {
  it("reads the current metric names", () => {
    expect(readVllmMetrics(VLLM_V1)).toEqual({
      running: 3,
      waiting: 1,
      kvCacheUsage: 0.125,
      promptTokensTotal: 120345,
      generationTokensTotal: 45678,
    });
  });

  it("reads older names and skips missing ones", () => {
    expect(readVllmMetrics(VLLM_OLD)).toEqual({
      running: 2,
      waiting: 0,
      kvCacheUsage: 0.5,
      promptTokensTotal: null,
      generationTokensTotal: 10,
    });
  });

  it("sums a metric across label sets and ignores comments and NaN", () => {
    const totals = parsePrometheus('a{engine="0"} 1\na{engine="1"} 2\n# a 100\nb NaN\n');
    expect(totals.get("a")).toBe(3);
    expect(totals.has("b")).toBe(false);
  });

  it("returns nothing from an empty or unexpected page", () => {
    expect(readVllmMetrics("<html>502 Bad Gateway</html>")).toEqual({
      running: null,
      waiting: null,
      kvCacheUsage: null,
      promptTokensTotal: null,
      generationTokensTotal: null,
    });
  });
});

function entry(overrides: Partial<PanelEntry>): PanelEntry {
  return {
    task: "personalize",
    model: "google/gemma-4-26B-A4B-it",
    servedFrom: "live",
    latencyMs: 1000,
    promptTokens: 400,
    completionTokens: 100,
    tokensPerSec: 100,
    costEur: 0.0001,
    gpu: "AMD Instinct MI300X",
    validationRetries: 0,
    ...overrides,
  };
}

describe("summarizeLog", () => {
  it("aggregates a session", () => {
    const summary = summarizeLog([
      entry({ viewId: "v1", latencyMs: 900, gateBlocked: 4, qualityRejections: 1 }),
      entry({ viewId: "v1", latencyMs: 1100 }),
      entry({ viewId: "v2", latencyMs: 1000, costEur: 0.0004, tokensPerSec: 200 }),
      entry({ task: "order", latencyMs: 3000, costEur: 0.0003, gateBlocked: 1, validationRetries: 1 }),
      entry({ task: "order", latencyMs: 2000, costEur: 0.0005 }),
    ]);
    expect(summary.calls).toBe(5);
    expect(summary.medianLatencyMs).toBe(1100);
    expect(summary.avgTokensPerSec).toBeCloseTo(120);
    // v1 = 0.0002, v2 = 0.0004
    expect(summary.eurPerMenuView).toBeCloseTo(0.0003, 10);
    expect(summary.eurPerOrder).toBeCloseTo(0.0004, 10);
    expect(summary.gateBlocked).toBe(5);
    expect(summary.rejectedOutputs).toBe(2);
    expect(summary.totalTokens).toBe(2500);
  });

  it("leaves costs unknown until they can be computed", () => {
    const summary = summarizeLog([entry({ viewId: "v1", costEur: null }), entry({ viewId: "v1" })]);
    expect(summary.eurPerMenuView).toBeNull();
    expect(summary.eurPerOrder).toBeNull();
    expect(summarizeLog([]).medianLatencyMs).toBeNull();
  });
});
