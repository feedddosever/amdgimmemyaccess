"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useHealth, useMetaLog, useServerMetrics } from "@/components/amd/hooks";
import ModelBadge from "@/components/amd/ModelBadge";
import { CallTable, ServerSection, SummaryTiles } from "@/components/amd/PanelSections";
import { summarizeLog } from "@/lib/panel";

const DOT = { live: "bg-green-500", offline: "bg-red-500", mock: "bg-zinc-400" };

function DrawerBody({ onClose }: { onClose: () => void }) {
  const health = useHealth();
  const [entries] = useMetaLog();
  const server = useServerMetrics();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="amd-drawer-title"
        lang="en"
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-paper p-5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <h2 id="amd-drawer-title" className="text-xl font-semibold">
            AMD panel
          </h2>
          <button type="button" onClick={onClose} aria-label="Close AMD panel" className="min-h-11 min-w-11 rounded-full text-2xl leading-none text-muted">
            ×
          </button>
        </header>
        <ModelBadge health={health} />
        <SummaryTiles summary={summarizeLog(entries)} />
        <ServerSection metrics={server.metrics} tokensPerSec={server.tokensPerSec} />
        <CallTable entries={entries} limit={8} compact />
        <Link href="/metrics" className="min-h-11 content-center text-center font-medium text-primary underline underline-offset-4" onClick={onClose}>
          Open the full panel
        </Link>
      </aside>
    </div>
  );
}

function DrawerButton() {
  const [open, setOpen] = useState(false);
  const health = useHealth();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="fixed bottom-4 left-4 z-40 flex min-h-11 print:hidden items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className={`inline-block size-2.5 rounded-full ${health ? DOT[health.status] : "bg-zinc-400"}`} aria-hidden />
        AMD
      </button>
      {open && <DrawerBody onClose={() => setOpen(false)} />}
    </>
  );
}

// A toggleable AMD drawer on every page; hidden on /metrics and inside the demo's phone frame.
export default function AmdDrawer() {
  const [embedded] = useState(() => window.self !== window.top);
  const pathname = usePathname();
  if (embedded || pathname === "/metrics") return null;
  return <DrawerButton />;
}
