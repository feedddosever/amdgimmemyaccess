import type { LLMMeta } from "@/lib/llm";

// One row of the AMD panel's session log: a model call's meta, plus what the
// diner page knew when it recorded it.
export type PanelEntry = LLMMeta & {
  at?: string;
  // Personalize calls of the same menu view share a viewId.
  viewId?: string;
  // Dishes the gate kept from the diner: hidden in that menu view, or removed from that order.
  gateBlocked?: number;
};

export type PanelSummary = {
  calls: number;
  medianLatencyMs: number | null;
  avgTokensPerSec: number | null;
  eurPerMenuView: number | null;
  eurPerOrder: number | null;
  gateBlocked: number;
  rejectedOutputs: number;
  totalTokens: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeLog(entries: PanelEntry[]): PanelSummary {
  const views = new Map<string, (number | null)[]>();
  for (const entry of entries) {
    if (entry.task === "personalize" && entry.viewId) views.set(entry.viewId, [...(views.get(entry.viewId) ?? []), entry.costEur]);
  }
  // A view's cost is known only if every one of its calls has a cost.
  const viewCosts = [...views.values()].filter((costs) => costs.every((cost) => cost !== null)) as number[][];
  const orderCosts = entries.filter((entry) => entry.task === "order" && entry.costEur !== null).map((entry) => entry.costEur as number);

  return {
    calls: entries.length,
    medianLatencyMs: median(entries.map((entry) => entry.latencyMs)),
    avgTokensPerSec: mean(entries.filter((entry) => entry.completionTokens > 0).map((entry) => entry.tokensPerSec)),
    eurPerMenuView: mean(viewCosts.map((costs) => costs.reduce((sum, cost) => sum + cost, 0))),
    eurPerOrder: mean(orderCosts),
    gateBlocked: entries.reduce((sum, entry) => sum + (entry.gateBlocked ?? 0), 0),
    rejectedOutputs: entries.reduce((sum, entry) => sum + entry.validationRetries + (entry.qualityRejections ?? 0), 0),
    totalTokens: entries.reduce((sum, entry) => sum + entry.promptTokens + entry.completionTokens, 0),
  };
}
