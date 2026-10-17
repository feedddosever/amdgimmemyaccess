import { describe, expect, it } from "vitest";
import { BenchResultsSchema, benchMarkdown, eurPer1000, percentile } from "@/lib/bench";

describe("bench math", () => {
  it("prices 1,000 units the same way the app prices a call", () => {
    // 1000 × 2,000 tokens × $2/h × 0.9 €/$ ÷ (1,000 tokens/s × 3,600 s) = €1.00
    expect(eurPer1000(2000, 1000, 2, 0.9)).toBeCloseTo(1, 10);
    expect(eurPer1000(null, 1000, 2, 0.9)).toBeNull();
    expect(eurPer1000(2000, 0, 2, 0.9)).toBeNull();
    expect(eurPer1000(2000, 1000, null, 0.9)).toBeNull();
  });

  it("takes nearest-rank percentiles", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([], 50)).toBeNull();
  });

  it("writes a markdown table that ends with the env value to set", () => {
    const results = BenchResultsSchema.parse({
      runAt: "2026-10-17T12:00:00.000Z",
      model: "google/gemma-4-26B-A4B-it",
      gpu: "AMD Instinct MI300X",
      server: "vLLM",
      durationSec: 60,
      gpuHourlyUsd: 1.99,
      eurPerUsd: 0.86,
      callsPerView: 5,
      tokensPerView: 4200,
      tokensPerOrder: 2600,
      levels: [
        {
          concurrency: 32,
          requests: 600,
          errors: 0,
          requestsPerSec: 10,
          p50Ms: 2500,
          p95Ms: 4100,
          outputTokensPerSec: 2500,
          errorRate: 0,
          validRate: 1,
          eurPer1000Views: 0.8,
          eurPer1000Orders: 0.49,
        },
      ],
      benchTokensPerSec: 2500,
    });
    const markdown = benchMarkdown(results);
    expect(markdown).toContain("| 32 | 10.00 | 2.50 s | 4.10 s | 2500 | 0.0% | 100.0% | 0.800 | 0.490 |");
    expect(markdown.trim().endsWith("BENCH_TOKENS_PER_SEC=2500")).toBe(true);
  });
});
