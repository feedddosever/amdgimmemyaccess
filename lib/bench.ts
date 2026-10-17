import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Results of scripts/bench.ts, committed as bench/results.json and shown on /about.

const BenchLevelSchema = z.object({
  concurrency: z.int(),
  requests: z.int(),
  errors: z.int(),
  requestsPerSec: z.number(),
  p50Ms: z.number().nullable(),
  p95Ms: z.number().nullable(),
  outputTokensPerSec: z.number(),
  errorRate: z.number(),
  validRate: z.number().nullable(),
  eurPer1000Views: z.number().nullable(),
  eurPer1000Orders: z.number().nullable(),
});

export const BenchResultsSchema = z.object({
  runAt: z.string(),
  model: z.string(),
  gpu: z.string(),
  server: z.string(),
  durationSec: z.number(),
  gpuHourlyUsd: z.number().nullable(),
  eurPerUsd: z.number().nullable(),
  callsPerView: z.int(),
  tokensPerView: z.number().nullable(),
  tokensPerOrder: z.number().nullable(),
  levels: z.array(BenchLevelSchema),
  benchTokensPerSec: z.number().nullable(),
});

export type BenchLevel = z.infer<typeof BenchLevelSchema>;
export type BenchResults = z.infer<typeof BenchResultsSchema>;

// Same rule as the per-call cost in lib/llm.ts: every token pays its share of a
// GPU hour at the measured output throughput, so 1,000 units cost
// 1000 × tokens per unit × GPU_HOURLY_USD × EUR_PER_USD / (tokens/s × 3600).
export function eurPer1000(
  tokensPerUnit: number | null,
  outputTokensPerSec: number,
  gpuHourlyUsd: number | null,
  eurPerUsd: number | null,
): number | null {
  if (tokensPerUnit === null || gpuHourlyUsd === null || eurPerUsd === null || outputTokensPerSec <= 0) return null;
  return (1000 * tokensPerUnit * gpuHourlyUsd * eurPerUsd) / (outputTokensPerSec * 3600);
}

// Nearest-rank percentile.
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function fixed(value: number | null, digits: number): string {
  return value === null ? "–" : value.toFixed(digits);
}

export function benchMarkdown(results: BenchResults): string {
  const lines = [
    `# MenuBridge benchmark`,
    "",
    `${results.model} on ${results.gpu} (${results.server}), ${results.durationSec} s per level, run ${results.runAt}.`,
    `Prices: GPU $${fixed(results.gpuHourlyUsd, 2)}/h, ${fixed(results.eurPerUsd, 4)} EUR per USD. ` +
      `A menu view is ${results.callsPerView} personalize calls, ${fixed(results.tokensPerView, 0)} tokens; an order is ${fixed(results.tokensPerOrder, 0)} tokens.`,
    "",
    "| Concurrency | Requests/s | p50 latency | p95 latency | Output tokens/s | Error rate | Valid JSON | EUR per 1,000 menu views | EUR per 1,000 orders |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...results.levels.map(
      (level) =>
        `| ${level.concurrency} | ${level.requestsPerSec.toFixed(2)} | ${fixed(level.p50Ms === null ? null : level.p50Ms / 1000, 2)} s | ` +
        `${fixed(level.p95Ms === null ? null : level.p95Ms / 1000, 2)} s | ${level.outputTokensPerSec.toFixed(0)} | ` +
        `${(level.errorRate * 100).toFixed(1)}% | ${level.validRate === null ? "–" : `${(level.validRate * 100).toFixed(1)}%`} | ` +
        `${fixed(level.eurPer1000Views, 3)} | ${fixed(level.eurPer1000Orders, 3)} |`,
    ),
    "",
    `BENCH_TOKENS_PER_SEC=${fixed(results.benchTokensPerSec, 0)}`,
    "",
  ];
  return lines.join("\n");
}

export async function getBenchResults(): Promise<BenchResults | null> {
  "use cache";
  try {
    const raw = await readFile(path.join(process.cwd(), "bench", "results.json"), "utf8");
    const parsed = BenchResultsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
