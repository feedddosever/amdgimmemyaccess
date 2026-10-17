import { connection } from "next/server";
import { config } from "@/lib/config";
import { readVllmMetrics, type ServerMetrics } from "@/lib/prometheus";

export const maxDuration = 60;

const EMPTY = { running: null, waiting: null, kvCacheUsage: null, promptTokensTotal: null, generationTokensTotal: null };

// vLLM's Prometheus metrics, for the AMD panel.
export async function GET() {
  await connection();
  const cfg = config();
  if (cfg.mock) return Response.json({ status: "mock", ...EMPTY } satisfies ServerMetrics);
  const offline = Response.json({ status: "offline", ...EMPTY } satisfies ServerMetrics);
  if (!cfg.metricsURL) return offline;
  try {
    const response = await fetch(cfg.metricsURL, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return offline;
    return Response.json({ status: "live", ...readVllmMetrics(await response.text()) } satisfies ServerMetrics);
  } catch {
    return offline;
  }
}
