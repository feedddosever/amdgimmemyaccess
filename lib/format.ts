import { LOCALES, type Lang } from "@/lib/i18n";

export function formatPrice(eur: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency: "EUR" }).format(eur);
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// Costs per call are fractions of a cent, so show 2 significant digits.
export function formatCost(eur: number | null): string {
  if (eur === null) return "–";
  if (eur === 0) return "0";
  return eur >= 0.01 ? eur.toFixed(2) : eur.toPrecision(2);
}
