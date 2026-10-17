import { formatCost, formatLatency } from "@/lib/format";
import type { PanelEntry, PanelSummary } from "@/lib/panel";
import type { ServerMetrics } from "@/lib/prometheus";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-line">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

export function SummaryTiles({ summary }: { summary: PanelSummary }) {
  const euro = (value: number | null) => (value === null ? "–" : `€${formatCost(value)}`);
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
      <Tile label="Median latency" value={summary.medianLatencyMs === null ? "–" : formatLatency(summary.medianLatencyMs)} />
      <Tile label="Average tokens/s" value={summary.avgTokensPerSec === null ? "–" : String(Math.round(summary.avgTokensPerSec))} />
      <Tile label="EUR per menu view" value={euro(summary.eurPerMenuView)} />
      <Tile label="EUR per order" value={euro(summary.eurPerOrder)} />
      <Tile label="Dishes blocked by the gate" value={String(summary.gateBlocked)} />
      <Tile label="Outputs rejected" value={String(summary.rejectedOutputs)} />
      <Tile label="Model calls" value={String(summary.calls)} />
      <Tile label="Tokens" value={compact.format(summary.totalTokens)} />
      </div>
    </div>
  );
}

// Fill carries severity; the track is a lighter step of the same color.
function Meter({ fraction }: { fraction: number }) {
  const color = fraction >= 0.9 ? "bg-danger" : fraction >= 0.7 ? "bg-amber-500" : "bg-primary";
  const track = fraction >= 0.9 ? "bg-danger/15" : fraction >= 0.7 ? "bg-amber-500/20" : "bg-primary/15";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${track}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label="KV cache usage">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, fraction * 100)}%` }} />
    </div>
  );
}

export function ServerSection({ metrics, tokensPerSec }: { metrics: ServerMetrics | null; tokensPerSec: number | null }) {
  if (!metrics || metrics.status !== "live") {
    const why = metrics?.status === "mock" ? "Mock mode: no GPU server is being called." : "GPU server offline: no live metrics.";
    return <p className="rounded-xl bg-white p-3 text-sm text-muted ring-1 ring-line">{why}</p>;
  }
  const value = (n: number | null) => (n === null ? "–" : compact.format(n));
  return (
    <div className="@container flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm @xl:grid-cols-4">
        <p>
          <span className="block text-xs text-muted">Running</span>
          <span className="text-lg font-semibold">{value(metrics.running)}</span>
        </p>
        <p>
          <span className="block text-xs text-muted">Waiting</span>
          <span className="text-lg font-semibold">{value(metrics.waiting)}</span>
        </p>
        <p>
          <span className="block text-xs text-muted">Server tokens/s</span>
          <span className="text-lg font-semibold">{tokensPerSec === null ? "–" : String(Math.round(tokensPerSec))}</span>
        </p>
        <p>
          <span className="block text-xs text-muted">Tokens generated</span>
          <span className="text-lg font-semibold">{value(metrics.generationTokensTotal)}</span>
        </p>
      </div>
      {metrics.kvCacheUsage !== null && (
        <div>
          <p className="mb-1 flex justify-between text-xs text-muted">
            <span>KV cache</span>
            <span>{Math.round(metrics.kvCacheUsage * 100)}%</span>
          </p>
          <Meter fraction={metrics.kvCacheUsage} />
        </div>
      )}
    </div>
  );
}

// compact: fewer columns, for the drawer.
export function CallTable({ entries, limit, compact: narrow = false }: { entries: PanelEntry[]; limit?: number; compact?: boolean }) {
  const rows = [...entries].reverse().slice(0, limit);
  if (rows.length === 0) return <p className="text-sm text-muted">No model calls yet. Open a menu or place an order.</p>;
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 text-right font-medium">Latency</th>
            {!narrow && <th className="px-3 py-2 text-right font-medium">Tokens in/out</th>}
            {!narrow && <th className="px-3 py-2 text-right font-medium">Tokens/s</th>}
            <th className="px-3 py-2 text-right font-medium">EUR</th>
          </tr>
        </thead>
        <tbody className="whitespace-nowrap tabular-nums">
          {rows.map((entry, index) => (
            <tr key={`${entry.at}-${index}`} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5">{entry.task}</td>
              <td className="px-3 py-1.5">{entry.servedFrom}</td>
              <td className="px-3 py-1.5 text-right">{formatLatency(entry.latencyMs)}</td>
              {!narrow && (
                <td className="px-3 py-1.5 text-right">
                  {entry.promptTokens}/{entry.completionTokens}
                </td>
              )}
              {!narrow && <td className="px-3 py-1.5 text-right">{Math.round(entry.tokensPerSec)}</td>}
              <td className="px-3 py-1.5 text-right">{formatCost(entry.costEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
