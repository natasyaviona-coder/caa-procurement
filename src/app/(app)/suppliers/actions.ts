"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, requireProfile } from "@/lib/auth";
import { readSheet, sheetImage } from "@/lib/xlsx-view";
import type {
  ContactChannel,
  SupplierPlatform,
} from "@/lib/types/database";

const CONTACT_CHANNELS = ["wechat", "phone", "email", "other"] as const;
const PLATFORMS = ["1688", "alibaba", "direct_factory", "other"] as const;

function parseEnum<T extends readonly string[]>(
  set: T,
  raw: FormDataEntryValue | null
): T[number] | null {
  if (raw == null) return null;
  const v = String(raw);
  if (v === "" || v === "none") return null;
  return (set as readonly string[]).includes(v) ? (v as T[number]) : null;
}

function parseInt0(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function readSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  return {
    name,
    contact_channel: parseEnum(CONTACT_CHANNELS, formData.get("contact_channel")) as
      | ContactChannel
      | null,
    contact_handle:
      String(formData.get("contact_handle") ?? "").trim() || null,
    platform: parseEnum(PLATFORMS, formData.get("platform")) as
      | SupplierPlatform
      | null,
    payment_terms: String(formData.get("payment_terms") ?? "").trim() || null,
    typical_lead_time_days: parseInt0(formData.get("typical_lead_time_days")),
    reliability_notes:
      String(formData.get("reliability_notes") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
  };
}

export async function createSupplier(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readSupplier(formData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/suppliers");
  revalidatePath("/");
  return data;
}

export async function updateSupplier(id: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const payload = readSupplier(formData);
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

// ------------------------- xlsx import --------------------------------------
export type SupplierImportMapping = {
  sheetIndex: number;
  headerRowIdx: number;
  nameCol: number;
  contactCol: number | null;
  leadTimeCol: number | null;
  paymentCol: number | null; // TOP / cash
  addressCol: number | null;
};

// One xlsx of suppliers (one row each), with the business card ("kartu nama")
// as an embedded photo per row. Extracts each card image to storage and
// inserts the suppliers.
export async function importSuppliers(
  storagePath: string,
  fileName: string,
  mapping: SupplierImportMapping
): Promise<{ inserted: number; cards: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(storagePath);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not read the file");

  const buffer = Buffer.from(await blob.arrayBuffer());
  const grid = readSheet(buffer, mapping.sheetIndex, { maxRows: 3000 });
  const dataRows = grid.rows.slice(mapping.headerRowIdx + 1);

  const cell = (row: (typeof dataRows)[number], col: number | null) =>
    col != null ? (row.cells[col] ?? "").trim() : "";

  let cards = 0;
  const toInsert: {
    name: string;
    contact_handle: string | null;
    typical_lead_time_days: number | null;
    payment_terms: string | null;
    address: string | null;
    business_card_url: string | null;
  }[] = [];

  for (const r of dataRows) {
    const name = cell(r, mapping.nameCol);
    if (!name) continue;

    let cardUrl: string | null = null;
    const img = sheetImage(buffer, mapping.sheetIndex, r.rowNum);
    if (img) {
      const ext = img.contentType === "image/png" ? "png" : "jpg";
      const path = `supplier-card/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("field-photos")
        .upload(path, img.data, { contentType: img.contentType, upsert: true });
      if (!upErr) {
        cardUrl = supabase.storage.from("field-photos").getPublicUrl(path).data.publicUrl;
        cards++;
      }
    }

    const leadRaw = cell(r, mapping.leadTimeCol).replace(/[^0-9]/g, "");
    toInsert.push({
      name,
      contact_handle: cell(r, mapping.contactCol) || null,
      typical_lead_time_days: leadRaw ? Number(leadRaw) : null,
      payment_terms: cell(r, mapping.paymentCol) || null,
      address: cell(r, mapping.addressCol) || null,
      business_card_url: cardUrl,
    });
  }

  if (toInsert.length === 0) throw new Error("No supplier rows found with that mapping");

  for (let i = 0; i < toInsert.length; i += 200) {
    const { error } = await supabase.from("suppliers").insert(toInsert.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  await supabase.storage.from("price-lists").remove([storagePath]);
  revalidatePath("/suppliers");
  return { inserted: toInsert.length, cards };
}
