"use client";

import { useHealth, useMetaLog } from "@/components/amd/hooks";
import ModelBadge from "@/components/amd/ModelBadge";
import { formatCost, formatLatency } from "@/lib/format";
import { summarizeLog } from "@/lib/panel";

// Live strip for the demo: the model, the GPU, and what the last calls cost.
export default function AmdStrip() {
  const health = useHealth();
  const [entries] = useMetaLog();
  const summary = summarizeLog(entries);
  const last = entries.at(-1);
  const euro = (value: number | null) => (value === null ? "–" : formatCost(value));

  return (
    <section lang="en" aria-label="AMD panel" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-ink px-5 py-3 text-sm text-white">
      <ModelBadge health={health} dark />
      {last ? (
        <p className="tabular-nums">
          Last: {last.task} · {last.servedFrom} · {formatLatency(last.latencyMs)} · {Math.round(last.tokensPerSec)} tok/s · EUR {formatCost(last.costEur)}
        </p>
      ) : (
        <p className="text-white/70">No model calls yet</p>
      )}
      <p className="tabular-nums text-white/80">
        EUR per menu view {euro(summary.eurPerMenuView)} · per order {euro(summary.eurPerOrder)} · {summary.gateBlocked} dishes blocked by the gate ·{" "}
        {summary.calls} calls
      </p>
    </section>
  );
}
