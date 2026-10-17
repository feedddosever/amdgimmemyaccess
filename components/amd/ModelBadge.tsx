import type { Health } from "@/components/amd/hooks";

const DOT: Record<Health["status"], string> = {
  live: "bg-green-500",
  offline: "bg-red-500",
  mock: "bg-zinc-400",
};

export const MODEL_LINE = "Gemma 4 26B-A4B · vLLM · ROCm · AMD Instinct MI300X (192 GB)";

export default function ModelBadge({ health, dark = false }: { health: Health | null; dark?: boolean }) {
  const status = health?.status;
  return (
    <p className={`font-semibold ${dark ? "text-white" : "text-ink"}`}>
      <span className={`mr-2 inline-block size-2.5 rounded-full align-middle ${status ? DOT[status] : "bg-zinc-300"}`} aria-hidden />
      {MODEL_LINE}{" "}
      <span className={`whitespace-nowrap font-normal ${dark ? "text-white/70" : "text-muted"}`}>{status ?? "checking…"}</span>
    </p>
  );
}
