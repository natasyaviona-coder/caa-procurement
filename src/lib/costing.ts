// Mirrors the computed-value formulas in CLAUDE.md section 9, validated
// against the existing Excel restock-decision workbook. Pure functions —
// no DB/network access — so both the dashboard and detail page use the
// same logic without drifting.

export type UrgencyLevel = "Restock Now" | "Plan Soon" | "OK";

export function computeStockPosition(input: {
  currentStockOnHand: number;
  incomingPoQty: number;
  salesVelocity3moAvg: number | null;
  leadTimeDays: number | null;
  safetyStockDays: number | null;
}) {
  const totalAvailable = input.currentStockOnHand + input.incomingPoQty;
  const dailyVelocity =
    input.salesVelocity3moAvg && input.salesVelocity3moAvg > 0
      ? input.salesVelocity3moAvg / 30
      : 0;

  const daysOfStockRemaining =
    dailyVelocity > 0 ? totalAvailable / dailyVelocity : Infinity;

  const leadTime = input.leadTimeDays ?? 0;
  const safetyStock = input.safetyStockDays ?? 0;
  const threshold = leadTime + safetyStock;
  const reorderPoint = dailyVelocity * threshold;

  let urgency: UrgencyLevel;
  if (dailyVelocity <= 0 || threshold <= 0) {
    // No sales-velocity or lead-time data to judge urgency against.
    urgency = "OK";
  } else if (daysOfStockRemaining <= threshold) {
    urgency = "Restock Now";
  } else if (daysOfStockRemaining <= threshold * 1.5) {
    urgency = "Plan Soon";
  } else {
    urgency = "OK";
  }

  return { totalAvailable, daysOfStockRemaining, reorderPoint, urgency };
}

// competitor_price_best_match (CLAUDE.md section 9): lowest competitor price
// for a product among rows whose spec is a 'Same' match. Rows with a
// different/similar/unassessed spec don't count.
export function competitorBestMatch(
  prices: { price: number; spec_match: string | null }[]
): number | null {
  const same = prices
    .filter((p) => p.spec_match === "Same")
    .map((p) => p.price);
  return same.length > 0 ? Math.min(...same) : null;
}

export function computeCosting(input: {
  rmbPrice: number | null;
  fxRate: number;
  ongkirPerUnit: number | null;
  importDutyPct: number;
  targetHargaJual: number | null;
  proposedQty: number | null;
  assumedMonthlySalesPostRestock: number | null;
}) {
  if (input.rmbPrice == null) return null;

  const ongkir = input.ongkirPerUnit ?? 0;
  const hppLandedPerUnit =
    (input.rmbPrice * input.fxRate + ongkir) * (1 + input.importDutyPct);

  const marginPerUnit =
    input.targetHargaJual != null
      ? input.targetHargaJual - hppLandedPerUnit
      : null;

  const totalInvestment =
    input.proposedQty != null ? input.proposedQty * hppLandedPerUnit : null;

  const monthlyGrossProfit =
    marginPerUnit != null && input.assumedMonthlySalesPostRestock != null
      ? input.assumedMonthlySalesPostRestock * marginPerUnit
      : null;

  const paybackPeriodMonths =
    totalInvestment != null &&
    monthlyGrossProfit != null &&
    monthlyGrossProfit > 0
      ? totalInvestment / monthlyGrossProfit
      : null;

  const simpleAnnualizedRoi =
    totalInvestment != null && totalInvestment > 0 && monthlyGrossProfit != null
      ? (monthlyGrossProfit * 12) / totalInvestment
      : null;

  return {
    hppLandedPerUnit,
    marginPerUnit,
    totalInvestment,
    monthlyGrossProfit,
    paybackPeriodMonths,
    simpleAnnualizedRoi,
  };
}
