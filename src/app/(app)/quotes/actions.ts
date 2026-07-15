"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, requireProfile } from "@/lib/auth";

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: FormDataEntryValue | null): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  return v || null;
}

function parseUuid(raw: FormDataEntryValue | null): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v || v === "none") return null;
  return v;
}

function readQuote(formData: FormData) {
  const supplier_id = parseUuid(formData.get("supplier_id"));
  if (!supplier_id) throw new Error("Supplier is required");
  const rmb_price = parseNumber(formData.get("rmb_price"));
  if (rmb_price == null || rmb_price < 0)
    throw new Error("RMB price is required and must be ≥ 0");
  const quote_date =
    parseDate(formData.get("quote_date")) ??
    new Date().toISOString().slice(0, 10);

  const moqRaw = parseNumber(formData.get("moq"));
  const moq = moqRaw != null ? Math.trunc(moqRaw) : null;
  if (moq != null && moq <= 0) throw new Error("MOQ must be > 0 if set");

  return {
    supplier_id,
    product_id: parseUuid(formData.get("product_id")),
    rmb_price,
    moq,
    quote_date,
    valid_until: parseDate(formData.get("valid_until")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createQuote(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readQuote(formData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_quotes")
    .insert({ ...payload, created_by: profile.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/quotes");
  revalidatePath("/");
  return data;
}

export async function updateQuote(id: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readQuote(formData);
  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_quotes")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}
