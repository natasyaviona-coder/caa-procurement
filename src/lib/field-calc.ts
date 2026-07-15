// Quotes Field costing — mirrors the FEI workbook formulas exactly
// (verified against FEI_NEW_EN.xlsx row 2: price ¥42, rate 2700, freight
// 4.500.000/CBM, qty 8, CBM 0.095275 → HPP produk 113.400, ongkir 53.592,
// landed 170.242 — same numbers the workbook computes).
//
// Shared by the capture form (live calc) and the xlsx export so the two can
// never disagree.

export type FieldAssumptions = {
  fxRate: number; // RMB -> IDR
  freightPerCbm: number; // IDR per CBM
  adminPct: number; // 0.30 = 30% (platform/admin fees off the sell price)
  orderFee: number; // IDR per unit
  packagingFee: number; // IDR per unit
};

export const DEFAULT_ASSUMPTIONS: FieldAssumptions = {
  fxRate: 2700,
  freightPerCbm: 4_500_000,
  adminPct: 0.3,
  orderFee: 1250,
  packagingFee: 2000,
};

export type FieldQuoteInput = {
  priceRmb: number | null;
  qtyPerCarton: number | null;
  /** Direct CBM if the supplier gives it… */
  cbm: number | null;
  /** …or carton dimensions in cm, from which CBM is derived. */
  cartonP: number | null;
  cartonL: number | null;
  cartonT: number | null;
  estSellPrice: number | null;
} & FieldAssumptions;

export type FieldQuoteResult = {
  cbmEffective: number | null;
  hppProduk: number | null;
  ongkirPerUnit: number | null;
  hppLanded: number | null;
  /** (sell − landed) / sell */
  marginSimple: number | null;
  /** (1 − admin%) − landed/sell — the FEI workbook's margin definition */
  marginAfterAdmin: number | null;
};

export function computeFieldQuote(input: FieldQuoteInput): FieldQuoteResult {
  const cbmEffective =
    input.cbm != null && input.cbm > 0
      ? input.cbm
      : input.cartonP && input.cartonL && input.cartonT
        ? (input.cartonP * input.cartonL * input.cartonT) / 1_000_000
        : null;

  const hppProduk =
    input.priceRmb != null && input.priceRmb > 0
      ? input.priceRmb * input.fxRate
      : null;

  const ongkirPerUnit =
    cbmEffective != null && input.qtyPerCarton != null && input.qtyPerCarton > 0
      ? (input.freightPerCbm * cbmEffective) / input.qtyPerCarton
      : null;

  const hppLanded =
    hppProduk != null
      ? hppProduk + (ongkirPerUnit ?? 0) + input.orderFee + input.packagingFee
      : null;

  const sell = input.estSellPrice;
  const marginSimple =
    sell != null && sell > 0 && hppLanded != null
      ? (sell - hppLanded) / sell
      : null;
  const marginAfterAdmin =
    sell != null && sell > 0 && hppLanded != null
      ? 1 - input.adminPct - hppLanded / sell
      : null;

  return {
    cbmEffective,
    hppProduk,
    ongkirPerUnit,
    hppLanded,
    marginSimple,
    marginAfterAdmin,
  };
}
