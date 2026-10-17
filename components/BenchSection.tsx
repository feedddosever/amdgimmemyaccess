import type { BenchLevel, BenchResults } from "@/lib/bench";

const fmt = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
}

function compactTick(value: number): string {
  return value >= 1000 ? `${value / 1000}K` : String(value);
}

// One series: output tokens per second at each concurrency level. Columns grow
// from the baseline with a rounded data-end; the table below is the full view.
function TokensChart({ levels }: { levels: BenchLevel[] }) {
  const width = 560;
  const height = 240;
  const pad = { top: 24, right: 12, bottom: 40, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...levels.map((level) => level.outputTokensPerSec)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = plotW / levels.length;
  const barW = 24;
  const r = 4;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-semibold">Output tokens per second by number of concurrent requests</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl" role="img" aria-label="Column chart of output tokens per second at each concurrency level">
        {ticks.map((tick) => {
          const y = pad.top + plotH - (tick / max) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={pad.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-muted)">
                {compactTick(tick)}
              </text>
            </g>
          );
        })}
        {levels.map((level, i) => {
          const x = pad.left + band * i + (band - barW) / 2;
          const h = Math.max(1, (level.outputTokensPerSec / max) * plotH);
          const top = pad.top + plotH - h;
          const base = pad.top + plotH;
          const rr = Math.min(r, h);
          const d = `M${x},${base} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + barW - rr} Q${x + barW},${top} ${x + barW},${top + rr} V${base} Z`;
          return (
            <g key={level.concurrency}>
              <path d={d} fill="var(--color-terracotta)">
                <title>{`${level.concurrency} concurrent: ${fmt.format(level.outputTokensPerSec)} tokens/s, p50 ${((level.p50Ms ?? 0) / 1000).toFixed(2)} s`}</title>
              </path>
              <text x={x + barW / 2} y={top - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink)">
                {fmt.format(level.outputTokensPerSec)}
              </text>
              <text x={x + barW / 2} y={base + 18} textAnchor="middle" fontSize={12} fill="var(--color-muted)">
                {level.concurrency}
              </text>
            </g>
          );
        })}
        <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
          Concurrent requests
        </text>
      </svg>
    </figure>
  );
}

function money(value: number | null): string {
  return value === null ? "–" : `€${value < 0.1 ? value.toPrecision(2) : value.toFixed(2)}`;
}

export default function BenchSection({ results }: { results: BenchResults | null }) {
  if (!results) {
    return (
      <p className="rounded-xl bg-white p-4 text-muted ring-1 ring-line">
        No benchmark yet. Run <code className="font-mono">npm run bench</code> against the MI300X droplet and commit{" "}
        <code className="font-mono">bench/results.json</code>.
      </p>
    );
  }
  const date = new Date(results.runAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        {results.model} on one {results.gpu} with {results.server}. Realistic MenuBridge requests (menu descriptions in 8
        languages and orders in 6), {results.durationSec} s per level, run {date} (Rome). A menu view is{" "}
        {results.callsPerView} model calls.
      </p>
      <TokensChart levels={results.levels} />
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium">Concurrent</th>
              <th className="px-3 py-2 text-right font-medium">Requests/s</th>
              <th className="px-3 py-2 text-right font-medium">p50</th>
              <th className="px-3 py-2 text-right font-medium">p95</th>
              <th className="px-3 py-2 text-right font-medium">Output tokens/s</th>
              <th className="px-3 py-2 text-right font-medium">Errors</th>
              <th className="px-3 py-2 text-right font-medium">Valid JSON</th>
              <th className="px-3 py-2 text-right font-medium">Per 1,000 menu views</th>
              <th className="px-3 py-2 text-right font-medium">Per 1,000 orders</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {results.levels.map((level) => (
              <tr key={level.concurrency} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5">{level.concurrency}</td>
                <td className="px-3 py-1.5 text-right">{level.requestsPerSec.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">{level.p50Ms === null ? "–" : `${(level.p50Ms / 1000).toFixed(2)} s`}</td>
                <td className="px-3 py-1.5 text-right">{level.p95Ms === null ? "–" : `${(level.p95Ms / 1000).toFixed(2)} s`}</td>
                <td className="px-3 py-1.5 text-right">{fmt.format(level.outputTokensPerSec)}</td>
                <td className="px-3 py-1.5 text-right">{(level.errorRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">{level.validRate === null ? "–" : `${(level.validRate * 100).toFixed(1)}%`}</td>
                <td className="px-3 py-1.5 text-right">{money(level.eurPer1000Views)}</td>
                <td className="px-3 py-1.5 text-right">{money(level.eurPer1000Orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        Costs assume the droplet at ${results.gpuHourlyUsd ?? "–"}/h and {results.eurPerUsd ?? "–"} EUR per USD, with every
        token charged at the measured output rate (an upper bound). The app prices each call at the concurrency-32
        throughput: {results.benchTokensPerSec === null ? "–" : fmt.format(results.benchTokensPerSec)} tokens/s.
      </p>
    </div>
  );
}
