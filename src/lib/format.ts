export function formatIDR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function formatNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
