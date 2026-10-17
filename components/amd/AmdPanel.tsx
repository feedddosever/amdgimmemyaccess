"use client";

import { useHealth, useMetaLog, useServerMetrics } from "@/components/amd/hooks";
import ModelBadge from "@/components/amd/ModelBadge";
import { CallTable, ServerSection, SummaryTiles } from "@/components/amd/PanelSections";
import { summarizeLog } from "@/lib/panel";

// The full AMD panel at /metrics.
export default function AmdPanel() {
  const health = useHealth();
  const [entries, clear] = useMetaLog();
  const server = useServerMetrics();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">AMD panel</h1>
        <ModelBadge health={health} />
        <p className="text-sm text-muted">
          Every model call in this browser session, updated live from the menu, the order screen and the demo.
        </p>
      </header>
      <section className="flex flex-col gap-2" aria-labelledby="session-title">
        <h2 id="session-title" className="text-lg font-semibold">
          This session
        </h2>
        <SummaryTiles summary={summarizeLog(entries)} />
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="server-title">
        <h2 id="server-title" className="text-lg font-semibold">
          vLLM server
        </h2>
        <ServerSection metrics={server.metrics} tokensPerSec={server.tokensPerSec} />
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="calls-title">
        <div className="flex items-center justify-between">
          <h2 id="calls-title" className="text-lg font-semibold">
            Last {entries.length} calls
          </h2>
          <button type="button" onClick={clear} className="min-h-11 rounded-full px-4 text-sm text-muted ring-1 ring-line">
            Clear log
          </button>
        </div>
        <CallTable entries={entries} />
      </section>
    </div>
  );
}
