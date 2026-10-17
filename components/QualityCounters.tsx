"use client";

import Link from "next/link";
import { useMetaLog } from "@/components/amd/hooks";
import { summarizeLog } from "@/lib/panel";

// Live counters for the About page, from this browser's AMD panel log.
export default function QualityCounters() {
  const [entries] = useMetaLog();
  const summary = summarizeLog(entries);
  const counters = [
    { label: "model calls checked", value: summary.calls },
    { label: "outputs rejected by validation or the claim guard", value: summary.rejectedOutputs },
    { label: "dishes kept from diners by the gate", value: summary.gateBlocked },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 ring-1 ring-line">
      <p className="text-sm text-muted">Live, from this browser session:</p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {counters.map((counter) => (
          <li key={counter.label}>
            <span className="block text-2xl font-semibold">{counter.value}</span>
            <span className="text-sm text-muted">{counter.label}</span>
          </li>
        ))}
      </ul>
      <Link href="/metrics" className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary underline underline-offset-4">
        Open the AMD panel
      </Link>
    </div>
  );
}
