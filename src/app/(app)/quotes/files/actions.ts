"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, isAdmin, requireProfile } from "@/lib/auth";
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
