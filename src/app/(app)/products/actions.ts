"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, requireProfile } from "@/lib/auth";
import type { Brand } from "@/lib/types/database";

const BRANDS = ["rumah_raya", "surprice_store", "other"] as const;

function parseBrand(raw: FormDataEntryValue | null): Brand | null {
  if (!raw) return null;
  const v = String(raw);
  return (BRANDS as readonly string[]).includes(v) ? (v as Brand) : null;
}

function parseInt0(raw: FormDataEntryValue | null, fallback = 0): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function readProduct(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku) throw new Error("SKU is required");
  if (!name) throw new Error("Name is required");
  return {
    sku,
    name,
    brand: parseBrand(formData.get("brand")),
    category: String(formData.get("category") ?? "").trim() || null,
    spec_summary: String(formData.get("spec_summary") ?? "").trim() || null,
    photo_url: String(formData.get("photo_url") ?? "").trim() || null,
    current_stock_on_hand: parseInt0(formData.get("current_stock_on_hand"), 0),
    incoming_po_qty: parseInt0(formData.get("incoming_po_qty"), 0),
  };
}

export async function createProduct(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readProduct(formData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/products");
  revalidatePath("/");
  return data;
}

export async function updateProduct(id: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readProduct(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}
