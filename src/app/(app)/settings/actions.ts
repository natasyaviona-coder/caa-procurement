"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireProfile } from "@/lib/auth";

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function updateSettings(formData: FormData) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Only admins can edit settings");

  const fx_rate_rmb_idr = parseNumber(formData.get("fx_rate_rmb_idr"));
  if (fx_rate_rmb_idr == null || fx_rate_rmb_idr <= 0) {
    throw new Error("FX rate is required and must be > 0");
  }

  const safetyStockDaysRaw = parseNumber(formData.get("default_safety_stock_days"));
  const importDutyPctRaw = parseNumber(formData.get("default_import_duty_pct"));
  const container_cbm_cap = parseNumber(formData.get("container_cbm_cap"));
  const adminPctRaw = parseNumber(formData.get("default_admin_pct"));
  const targetMarginPctRaw = parseNumber(formData.get("default_target_margin_pct"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      fx_rate_rmb_idr,
      default_safety_stock_days:
        safetyStockDaysRaw != null ? Math.trunc(safetyStockDaysRaw) : 7,
      default_import_duty_pct: importDutyPctRaw != null ? importDutyPctRaw / 100 : 0.15,
      container_cbm_cap,
      default_admin_pct: adminPctRaw != null ? adminPctRaw / 100 : 0.3,
      default_target_margin_pct:
        targetMarginPctRaw != null ? targetMarginPctRaw / 100 : 0.3,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/competitors");
  revalidatePath("/");
}
