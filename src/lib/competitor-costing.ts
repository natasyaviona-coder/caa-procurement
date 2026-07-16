// Reverse a competitor's IDR sell price back to the sourcing HPP in RMB.
//
// Nat's model: sell = HPP(idr) + ongkir + admin + margin, where ongkir, admin
// and margin are each a percentage OF the sell price:
//   sell = HPP_idr + ongkir%·sell + admin%·sell + margin%·sell
//   => HPP_idr = sell · (1 - ongkir% - admin% - margin%)
//   => HPP_rmb = HPP_idr / fxRate
// e.g. sell 52,990, ongkir 44%, admin 30%, margin 10%, fx 2700
//   => 52,990 · 0.16 / 2700 ≈ 3.14 RMB

export const DEFAULT_ONGKIR_PCT = 0.44;

export type ReverseCostParams = {
  fxRate: number; // RMB -> IDR (e.g. 2700)
  adminPct: number; // fraction (e.g. 0.30)
  marginPct: number; // fraction (e.g. 0.10)
  ongkirPct?: number; // fraction of sell price (default 0.44)
};

export function reverseHppRmb(
  priceIdr: number | null,
  p: ReverseCostParams
): number | null {
  if (priceIdr == null || !Number.isFinite(priceIdr) || priceIdr <= 0) return null;
  const ongkir = p.ongkirPct ?? DEFAULT_ONGKIR_PCT;
  const factor = 1 - ongkir - p.adminPct - p.marginPct;
  if (!(p.fxRate > 0) || factor <= 0) return null;
  return (priceIdr * factor) / p.fxRate;
}
