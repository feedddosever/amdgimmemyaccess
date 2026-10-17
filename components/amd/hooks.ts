"use client";

import { useEffect, useState } from "react";
import { clearMetaLog, loadMetaLog, subscribe } from "@/lib/channel";
import type { PanelEntry } from "@/lib/panel";
import type { ServerMetrics } from "@/lib/prometheus";

export type Health = { status: "live" | "offline" | "mock"; model: string };

export function useHealth(intervalMs = 15_000): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/health")
        .then((response) => response.json() as Promise<Health>)
        .then((result) => alive && setHealth(result))
        .catch(() => alive && setHealth({ status: "offline", model: "" }));
    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [intervalMs]);
  return health;
}

// The session's last 50 model calls, updated live from every page and frame.
export function useMetaLog(): [PanelEntry[], () => void] {
  const [entries, setEntries] = useState<PanelEntry[]>(loadMetaLog);
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === "meta") setEntries((current) => [...current, ...message.metas].slice(-50));
      }),
    [],
  );
  const clear = () => {
    clearMetaLog();
    setEntries([]);
  };
  return [entries, clear];
}

// vLLM's own counters, polled; generated tokens per second comes from the
// difference between two polls.
export function useServerMetrics(intervalMs = 5_000): { metrics: ServerMetrics | null; tokensPerSec: number | null } {
  const [state, setState] = useState<{ metrics: ServerMetrics | null; tokensPerSec: number | null }>({
    metrics: null,
    tokensPerSec: null,
  });
  useEffect(() => {
    let alive = true;
    let previous: { at: number; total: number } | null = null;
    const poll = () =>
      fetch("/api/metrics")
        .then((response) => response.json() as Promise<ServerMetrics>)
        .then((metrics) => {
          if (!alive) return;
          const now = Date.now();
          const total = metrics.generationTokensTotal;
          const rate = previous && total !== null ? Math.max(0, (total - previous.total) / ((now - previous.at) / 1000)) : null;
          previous = total !== null ? { at: now, total } : null;
          setState({ metrics, tokensPerSec: rate });
        })
        .catch(() => alive && setState({ metrics: null, tokensPerSec: null }));
    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [intervalMs]);
  return state;
}
