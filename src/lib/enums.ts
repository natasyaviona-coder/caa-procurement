// Human-readable labels for DB enums. Keep in sync with 0001_phase1_schema.sql.

import type {
  AssumptionBasis,
  Brand,
  CompetitorPlatform,
  ConfidenceLevel,
  ContactChannel,
  DecisionStatus,
  SpecMatch,
  SupplierPlatform,
} from "@/lib/types/database";

export const CONTACT_CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: "wechat", label: "WeChat" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

export const SUPPLIER_PLATFORMS: {
  value: SupplierPlatform;
  label: string;
}[] = [
  { value: "1688", label: "1688" },
  { value: "alibaba", label: "Alibaba" },
  { value: "direct_factory", label: "Direct Factory" },
  { value: "other", label: "Other" },
];

export const BRANDS: { value: Brand; label: string }[] = [
  { value: "rumah_raya", label: "Rumah Raya" },
  { value: "surprice_store", label: "Surprice Store" },
  { value: "other", label: "Other" },
];

export const ASSUMPTION_BASES: AssumptionBasis[] = [
  "Historical Restock Data",
  "Competitor Benchmark",
  "Affiliate Campaign Projection",
  "Wild Assumption",
];

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["High", "Medium", "Low"];

export const DECISION_STATUSES: DecisionStatus[] = [
  "Needs Review",
  "Approve",
  "Hold",
  "Reject",
];

export const COMPETITOR_PLATFORMS: CompetitorPlatform[] = [
  "TikTok Shop",
  "Shopee",
  "Other",
];

export const SPEC_MATCHES: SpecMatch[] = ["Same", "Similar", "Different"];

export function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
