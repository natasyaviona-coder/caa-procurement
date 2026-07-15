// "Reversible RMB" — the target purchase price in RMB to hunt for on 1688 so a
// competitor's product can be landed and sold near their price with a healthy
// margin. Works backward from the competitor's IDR selling price:
//
//   landed_target = price_idr * (1 − admin% − target_margin%)
//   reversible_rmb = landed_target / fx_rate
//
// Per-unit shipping (ongkir) is intentionally ignored — CBM isn't known for a
// competitor's product — so this is a target "before shipping", which keeps the
// number conservative (you'll pay a bit less RMB in practice to leave shipping room).

export type ReverseAssumptions = {
  fxRate: number;
  adminPct: number; // 0.30 = 30%
  targetMarginPct: number; // 0.30 = 30%
};

export function reversibleRmb(
  priceIdr: number | null | undefined,
  a: ReverseAssumptions
): number | null {
  if (priceIdr == null || priceIdr <= 0) return null;
  if (a.fxRate <= 0) return null;
  const takeaway = a.adminPct + a.targetMarginPct;
  if (takeaway >= 1) return null; // margins exceed the whole price — not sourceable
  const landedTarget = priceIdr * (1 - takeaway);
  return landedTarget / a.fxRate;
}

// Parse an Indonesian-formatted number: "Rp 100.000" -> 100000,
// "100.000,50" -> 100000.5, "1.234.567" -> 1234567.
export function parseIdr(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  let n: number;
  if (cleaned.includes(",")) {
    const [intPart, decPart = "0"] = cleaned.split(",");
    n = Number(`${intPart.replace(/\./g, "")}.${decPart}`);
  } else {
    n = Number(cleaned.replace(/\./g, ""));
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}
