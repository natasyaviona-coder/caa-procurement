"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { canWrite, isAdmin, requireProfile } from "@/lib/auth";
import { listSheets, readSheet } from "@/lib/xlsx-view";
import { detectMapping } from "@/lib/pricelist-map";
import type { SupabaseClient } from "@supabase/supabase-js";

// Resolve a supplier from either an explicit id or a typed name, creating the
// supplier when the name is new. Reuses an existing same-named supplier
// (case-insensitive) instead of duplicating.
async function resolveSupplier(
  supabase: SupabaseClient,
  supplierId: string | null | undefined,
  newSupplierName: string | null | undefined
): Promise<string> {
  let id = supplierId?.trim() || null;
  const newName = newSupplierName?.trim() || null;
  if (!id && newName) {
    const { data: existing } = await supabase
      .from("suppliers")
      .select("id")
      .ilike("name", newName)
      .maybeSingle();
    if (existing) {
      id = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("suppliers")
        .insert({ name: newName })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = created.id;
      revalidatePath("/suppliers");
    }
  }
  if (!id) throw new Error("Pick a supplier or type a new supplier name");
  return id;
}

// Called after the browser has uploaded the file straight to Supabase Storage
// (direct upload avoids the server-action body-size limit on ~15MB files).
export async function recordUploadedFile(input: {
  fileName: string;
  storagePath: string;
  sizeBytes: number;
  supplierId?: string | null;
  newSupplierName?: string | null;
}) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const fileName = input.fileName.trim();
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported");
  }

  const supabase = await createClient();
  const supplierId = await resolveSupplier(
    supabase,
    input.supplierId,
    input.newSupplierName
  );

  const { error } = await supabase.from("price_list_files").insert({
    file_name: fileName,
    storage_path: input.storagePath,
    size_bytes: input.sizeBytes,
    supplier_id: supplierId,
    uploaded_by: profile.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/quotes/files");
}

export async function updateFileSupplier(
  fileId: string,
  input: { supplierId?: string | null; newSupplierName?: string | null }
) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const supplierId = await resolveSupplier(
    supabase,
    input.supplierId,
    input.newSupplierName
  );

  const { error } = await supabase
    .from("price_list_files")
    .update({ supplier_id: supplierId })
    .eq("id", fileId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes/files");
  revalidatePath(`/quotes/files/${fileId}`);
}

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: { type: "string" },
      description: "English translations, one per input line, in the same order.",
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

// Translate the Chinese product-name cells of one sheet into English via Claude
// and store them on the file (keyed by sheet index → row number). The raw file
// is never modified — the viewer overlays these translations. Requires
// ANTHROPIC_API_KEY.
export async function translateFile(
  fileId: string,
  sheetIndex: number
): Promise<{ translated: number }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Translation isn't configured yet — add ANTHROPIC_API_KEY (console.anthropic.com → API keys)."
    );
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("price_list_files")
    .select("id, storage_path, translations")
    .eq("id", fileId)
    .single();
  if (error || !file) throw new Error("File not found");

  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(file.storage_path);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not read the file");
  const buffer = Buffer.from(await blob.arrayBuffer());

  const sheets = listSheets(buffer);
  const safeSheet = sheetIndex >= 0 && sheetIndex < sheets.length ? sheetIndex : 0;
  const grid = readSheet(buffer, safeSheet, { maxRows: 5000 });
  const mapping = detectMapping(grid.rows);
  const nameCol = mapping?.columns.name;
  if (mapping == null || nameCol == null) {
    throw new Error("No product-name column was found to translate on this sheet");
  }

  const items: { rowNum: number; text: string }[] = [];
  for (const r of grid.rows.slice(mapping.headerRowIdx + 1)) {
    const text = (r.cells[nameCol] ?? "").trim();
    if (text) items.push({ rowNum: r.rowNum, text });
  }
  if (items.length === 0) throw new Error("No product names to translate on this sheet");

  const anthropic = new Anthropic({ apiKey });
  const result: Record<string, string> = {};

  // Chunk so each request stays small and reliable.
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const listText = chunk
      .map((it, idx) => `${idx + 1}. ${it.text.replace(/\s+/g, " ")}`)
      .join("\n");

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      output_config: { format: { type: "json_schema", schema: TRANSLATION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Translate each numbered Chinese product name into concise English. ` +
                `Keep model codes, numbers, sizes and units unchanged. ` +
                `Return a "translations" array with exactly ${chunk.length} items, ` +
                `in the same order as the input.\n\n${listText}`,
            },
          ],
        },
      ],
    });

    if (resp.stop_reason === "refusal") {
      throw new Error("Translation was declined for this content");
    }
    const textBlock = resp.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock) throw new Error("No translation was returned");
    const parsed = JSON.parse(textBlock.text) as { translations?: string[] };
    const list = parsed.translations ?? [];
    chunk.forEach((it, idx) => {
      const en = list[idx]?.trim();
      if (en) result[String(it.rowNum)] = en;
    });
  }

  const existing = (file.translations ?? {}) as Record<
    string,
    Record<string, string>
  >;
  const merged = { ...existing, [String(safeSheet)]: result };
  const { error: upErr } = await supabase
    .from("price_list_files")
    .update({ translations: merged })
    .eq("id", fileId);
  if (upErr) throw new Error(upErr.message);

  revalidatePath(`/quotes/files/${fileId}`);
  return { translated: Object.keys(result).length };
}

export async function deleteFile(fileId: string) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Only admins can delete files");

  const supabase = await createClient();
  const { data: file, error: fetchErr } = await supabase
    .from("price_list_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .single();
  if (fetchErr || !file) throw new Error("File not found");

  // Remove the storage object first; the metadata row is the source of truth
  // for the list, so it goes last (a dangling object is invisible, a dangling
  // row would 500 the viewer).
  const { error: rmErr } = await supabase.storage
    .from("price-lists")
    .remove([file.storage_path]);
  if (rmErr) throw new Error(rmErr.message);

  const { error: delErr } = await supabase
    .from("price_list_files")
    .delete()
    .eq("id", fileId);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/quotes/files");
}
