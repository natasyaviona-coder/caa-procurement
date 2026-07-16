"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWrite, isAdmin, requireProfile } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSheet, sheetImage, listSheets } from "@/lib/xlsx-view";
import { parseIdr } from "@/lib/reverse-rmb";
import {
  readCompetitorTemplate,
  type CompetitorTemplate,
} from "@/lib/competitor-template";

// price_idr is only a best-effort helper number (the real price is stored as
// text in fields.harga). Template Harga cells can be multi-variant
// ("9 inch :Rp.6.367 / 12 inch : Rp.5.120 …") — take only the FIRST price so
// the digits aren't glued into a giant number, and guard against overflowing
// the numeric(14,2) column.
function firstPriceIdr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw);
  const rp = s.match(/rp\.?\s*([0-9.,]+)/i);
  const candidate = rp ? rp[1] : s.split(/\r?\n/)[0];
  const n = parseIdr(candidate);
  return n != null && n < 1e12 ? n : null;
}

// ------------------------- Competitor CRUD ---------------------------------
function readCompetitor(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  return {
    name,
    specialization: String(formData.get("specialization") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createCompetitor(formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert(readCompetitor(formData))
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/competitors");
  redirect(`/competitors/${data.id}`);
}

export async function updateCompetitor(id: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .update(readCompetitor(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/competitors");
  revalidatePath(`/competitors/${id}`);
}

export async function deleteCompetitor(id: string) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Only admins can delete competitors");

  const supabase = await createClient();
  const { error } = await supabase.from("competitors").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/competitors");
}

export async function deleteCompetitorProduct(id: string, competitorId: string) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase.from("competitor_products").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/competitors/${competitorId}`);
}

// Tag a competitor product to one of our shared products, so it shows up as
// the market benchmark (sold count + price) when comparing that product in
// All Quotes. Pass null to unmap.
export async function assignCompetitorProductToProduct(
  competitorProductId: string,
  competitorId: string,
  productId: string | null
): Promise<void> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase
    .from("competitor_products")
    .update({ product_id: productId })
    .eq("id", competitorProductId);
  if (error) throw new Error(error.message);

  revalidatePath(`/competitors/${competitorId}`);
  revalidatePath("/quotes");
}

// Assign (or change) the competitor on a competitor product — used to file
// bulk-uploaded market pictures under a competitor after the fact.
export async function setCompetitorProductCompetitor(
  productId: string,
  competitorId: string | null
): Promise<void> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase
    .from("competitor_products")
    .update({ competitor_id: competitorId })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/competitors");
  if (competitorId) revalidatePath(`/competitors/${competitorId}`);
}

// ------------------------- Bulk picture upload ------------------------------
export type BulkPictureItem = {
  competitorId: string | null;
  name: string;
  priceIdr: number | null;
  info: string | null;
  rmb: number | null; // reverse HPP in RMB
  photoUrl: string | null;
};

function bulkFields(
  priceIdr: number | null,
  rmb: number | null,
  info: string | null
): Record<string, string> {
  return {
    sold: "",
    harga: priceIdr != null ? `Rp ${Math.round(priceIdr).toLocaleString("id-ID")}` : "",
    reverse_hpp: rmb != null ? rmb.toFixed(2) : "",
    reverse_ongkir: "",
    ukuran: info?.trim() || "",
    bahan: "",
    isi: "",
    spec_lain: "",
  };
}

// Insert bulk-uploaded market pictures as competitor products. The client has
// already extracted + cropped each one and uploaded its photo. competitor_id
// may be null (assign later).
export async function saveBulkCompetitorProducts(
  items: BulkPictureItem[]
): Promise<{ inserted: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const clean = items.filter(
    (it) => (it.name?.trim() || it.priceIdr != null || it.photoUrl)
  );
  if (clean.length === 0) throw new Error("Nothing to save");

  const supabase = await createClient();
  const rows = clean.map((it) => ({
    competitor_id: it.competitorId,
    name: it.name?.trim() || "(unnamed)",
    price_idr: it.priceIdr != null && it.priceIdr < 1e12 ? it.priceIdr : null,
    photo_url: it.photoUrl,
    spec_summary: it.info?.trim() || null,
    fields: bulkFields(it.priceIdr, it.rmb, it.info),
    source_file: "bulk-picture",
    created_by: profile.id,
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from("competitor_products")
      .insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  revalidatePath("/competitors");
  for (const id of new Set(clean.map((it) => it.competitorId).filter(Boolean))) {
    revalidatePath(`/competitors/${id}`);
  }
  return { inserted: rows.length };
}

// ------------------------- Product list import ------------------------------
export type ImportMapping = {
  sheetIndex: number;
  headerRowIdx: number; // index into the grid rows
  nameCol: number; // column index in a row's cells
  priceCol: number | null;
  photoCol: number | null;
  specCol: number | null;
  urlCol: number | null;
};

// Reads the uploaded workbook from storage, extracts rows per the mapping,
// inserts them as this competitor's products, then removes the temp file.
export async function importCompetitorProducts(
  competitorId: string,
  storagePath: string,
  fileName: string,
  mapping: ImportMapping
): Promise<{ inserted: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");
  if (mapping.nameCol == null) throw new Error("Pick which column is the product name");

  const supabase = await createClient();
  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(storagePath);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not read the file");

  const buffer = Buffer.from(await blob.arrayBuffer());
  const grid = readSheet(buffer, mapping.sheetIndex, { maxRows: 5000 });

  const rows = grid.rows.slice(mapping.headerRowIdx + 1);
  const toInsert: {
    competitor_id: string;
    name: string;
    price_idr: number | null;
    photo_url: string | null;
    spec_summary: string | null;
    product_url: string | null;
    source_file: string;
    created_by: string;
  }[] = [];

  for (const r of rows) {
    const name = (r.cells[mapping.nameCol] ?? "").trim();
    if (!name) continue;
    toInsert.push({
      competitor_id: competitorId,
      name,
      price_idr:
        mapping.priceCol != null ? firstPriceIdr(r.cells[mapping.priceCol]) : null,
      photo_url:
        mapping.photoCol != null && r.cells[mapping.photoCol]?.trim()
          ? r.cells[mapping.photoCol].trim()
          : null,
      spec_summary:
        mapping.specCol != null && r.cells[mapping.specCol]?.trim()
          ? r.cells[mapping.specCol].trim()
          : null,
      product_url:
        mapping.urlCol != null && r.cells[mapping.urlCol]?.trim()
          ? r.cells[mapping.urlCol].trim()
          : null,
      source_file: fileName,
      created_by: profile.id,
    });
  }

  if (toInsert.length === 0) throw new Error("No product rows found with that mapping");

  // Insert in chunks to stay well within payload limits.
  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await supabase
      .from("competitor_products")
      .insert(toInsert.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }

  // Temp import file is no longer needed — the products live in the DB now.
  await supabase.storage.from("price-lists").remove([storagePath]);

  revalidatePath(`/competitors/${competitorId}`);
  return { inserted: toInsert.length };
}

const IMG_EXT_MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// Shared core: insert a parsed template's rows into a competitor, extracting
// each row's embedded photo. Caller has already resolved the competitor and
// parsed the template. Does NOT delete the source file (caller decides).
async function insertTemplateRows(
  supabase: SupabaseClient,
  createdBy: string,
  competitorId: string,
  buffer: Buffer,
  sheetIndex: number,
  template: CompetitorTemplate,
  fileName: string
): Promise<{ inserted: number; photos: number }> {
  let photos = 0;
  const toInsert: {
    competitor_id: string;
    name: string;
    photo_url: string | null;
    product_url: string | null;
    fields: Record<string, string>;
    source_file: string;
    price_idr: number | null;
    created_by: string;
  }[] = [];

  for (const r of template.rows) {
    let photoUrl: string | null = null;
    const img = sheetImage(buffer, sheetIndex, r.rowNum);
    if (img) {
      const ext = img.contentType === "image/png" ? "png" : "jpg";
      const path = `competitor/${competitorId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("field-photos")
        .upload(path, img.data, {
          contentType: IMG_EXT_MIME[ext] ?? "image/jpeg",
          upsert: true,
        });
      if (!upErr) {
        photoUrl = supabase.storage.from("field-photos").getPublicUrl(path).data.publicUrl;
        photos++;
      }
    }

    toInsert.push({
      competitor_id: competitorId,
      name: r.name,
      photo_url: photoUrl,
      product_url: r.productUrl,
      fields: r.fields,
      source_file: fileName,
      price_idr: firstPriceIdr(r.fields.harga ?? null),
      created_by: createdBy,
    });
  }

  for (let i = 0; i < toInsert.length; i += 200) {
    const { error } = await supabase
      .from("competitor_products")
      .insert(toInsert.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  return { inserted: toInsert.length, photos };
}

// Find the first sheet in the workbook that parses as the competitor template.
function findTemplateSheet(
  buffer: Buffer
): { sheetIndex: number; template: CompetitorTemplate } | null {
  for (const s of listSheets(buffer)) {
    const template = readCompetitorTemplate(buffer, s.index);
    if (template.detected && template.rows.length > 0) {
      return { sheetIndex: s.index, template };
    }
  }
  return null;
}

// Reuse an existing competitor by (case-insensitive) name, else create one.
async function resolveCompetitorByName(
  supabase: SupabaseClient,
  name: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("competitors")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("competitors")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

// Import the CAA competitor template (BMW-style) into a known competitor.
export async function importCompetitorTemplate(
  competitorId: string,
  storagePath: string,
  fileName: string,
  sheetIndex: number
): Promise<{ inserted: number; photos: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(storagePath);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not read the file");

  const buffer = Buffer.from(await blob.arrayBuffer());
  const template = readCompetitorTemplate(buffer, sheetIndex);
  if (!template.detected || template.rows.length === 0) {
    throw new Error("This file doesn't match the competitor template");
  }

  const result = await insertTemplateRows(
    supabase,
    profile.id,
    competitorId,
    buffer,
    sheetIndex,
    template,
    fileName
  );

  await supabase.storage.from("price-lists").remove([storagePath]);
  revalidatePath(`/competitors/${competitorId}`);
  return result;
}

// Bulk path: one already-uploaded file → a competitor named after the file.
// Auto-detects which sheet holds the template. Used by the bulk uploader,
// once per file, so failures are isolated per file.
export async function importCompetitorFileByName(
  storagePath: string,
  fileName: string
): Promise<{ competitorId: string; competitorName: string; inserted: number; photos: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(storagePath);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not read the file");

  const buffer = Buffer.from(await blob.arrayBuffer());
  const found = findTemplateSheet(buffer);
  if (!found) throw new Error("No sheet matches the competitor template");

  const competitorName = fileName.replace(/\.xlsx$/i, "").trim() || "Competitor";
  const competitorId = await resolveCompetitorByName(supabase, competitorName);

  const result = await insertTemplateRows(
    supabase,
    profile.id,
    competitorId,
    buffer,
    found.sheetIndex,
    found.template,
    fileName
  );

  await supabase.storage.from("price-lists").remove([storagePath]);
  revalidatePath("/competitors");
  revalidatePath(`/competitors/${competitorId}`);
  return { competitorId, competitorName, ...result };
}
