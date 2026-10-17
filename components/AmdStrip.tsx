"use client";

import { useEffect, useState } from "react";
import { loadMetaLog, subscribe } from "@/lib/channel";
import { formatCost, formatLatency } from "@/lib/format";
import type { LLMMeta } from "@/lib/llm";

type Health = { status: "live" | "offline" | "mock"; model: string };

const DOT: Record<Health["status"], string> = {
  live: "bg-green-500",
  offline: "bg-red-500",
  mock: "bg-zinc-400",
};

// Live strip for the demo: the model, the GPU, and what the last calls cost.
export default function AmdStrip() {
  const [metas, setMetas] = useState<LLMMeta[]>(loadMetaLog);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === "meta") setMetas((current) => [...current, ...message.metas].slice(-50));
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health")
        .then((response) => response.json() as Promise<Health>)
        .then((result) => alive && setHealth(result))
        .catch(() => alive && setHealth({ status: "offline", model: "" }));
    check();
    const timer = setInterval(check, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const last = metas.at(-1);
  const totalCost = metas.every((meta) => meta.costEur !== null) ? metas.reduce((sum, meta) => sum + (meta.costEur ?? 0), 0) : null;
  const tokens = metas.reduce((sum, meta) => sum + meta.promptTokens + meta.completionTokens, 0);

  return (
    <section lang="en" aria-label="AMD panel" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-ink px-5 py-3 text-sm text-white">
      <p className="flex items-center gap-2 font-semibold">
        <span className={`inline-block size-2.5 rounded-full ${DOT[health?.status ?? "mock"]}`} aria-hidden />
        Gemma 4 26B-A4B · vLLM · ROCm · AMD Instinct MI300X (192 GB)
        <span className="font-normal text-white/70">{health ? health.status : "…"}</span>
      </p>
      {last ? (
        <p className="tabular-nums">
          Last: {last.task} · {last.servedFrom} · {formatLatency(last.latencyMs)} · {Math.round(last.tokensPerSec)} tok/s · EUR {formatCost(last.costEur)}
        </p>
      ) : (
        <p className="text-white/70">No model calls yet</p>
      )}
      <p className="tabular-nums text-white/80">
        Session: {metas.length} calls · {tokens.toLocaleString("en")} tokens · EUR {formatCost(totalCost)}
      </p>
    </section>
  );
}
