"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, isAdmin, requireProfile } from "@/lib/auth";
import { fetchGoogleSheetXlsx } from "@/lib/google-sheets";

export type SheetSelection = {
  index: number;
  name: string;
  kind: "supplier" | "other";
};

// Called after the browser uploaded the workbook straight to Storage
// (trips/… prefix inside the existing private price-lists bucket).
export async function registerTrip(input: {
  fileName: string;
  storagePath: string;
  sizeBytes: number;
}): Promise<{ id: string }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const name = input.fileName.trim().replace(/\.xlsx$/i, "");
  if (!input.fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      name,
      storage_path: input.storagePath,
      size_bytes: input.sizeBytes,
      uploaded_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/trips");
  return { id: data.id };
}

// Pull a link-shared Google Sheet into a stored snapshot (same downstream
// path as an .xlsx upload), remembering the source link for later refresh.
export async function registerTripFromGoogleSheet(
  sourceUrl: string
): Promise<{ id: string }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const { buffer, suggestedName } = await fetchGoogleSheetXlsx(sourceUrl.trim());
  const name = suggestedName || "Trip from Google Sheet";
  const storagePath = `trips/${crypto.randomUUID()}/${name.replace(/[^a-zA-Z0-9._-]+/g, "_")}.xlsx`;

  const supabase = await createClient();
  const { error: upErr } = await supabase.storage
    .from("price-lists")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("trips")
    .insert({
      name,
      storage_path: storagePath,
      size_bytes: buffer.length,
      source_url: sourceUrl.trim(),
      uploaded_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/trips");
  return { id: data.id };
}

// Re-pull the latest from the trip's stored Google Sheet link, overwriting the
// snapshot in place. Keeps the existing sheet selection (indices are stable
// unless sheets were added/removed in Google — re-edit if so).
export async function refreshTripFromSource(tripId: string) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { data: trip, error: fetchErr } = await supabase
    .from("trips")
    .select("id, storage_path, source_url")
    .eq("id", tripId)
    .single();
  if (fetchErr || !trip) throw new Error("Trip not found");
  if (!trip.source_url) throw new Error("This trip has no Google Sheet link to refresh from");

  const { buffer } = await fetchGoogleSheetXlsx(trip.source_url);
  const { error: upErr } = await supabase.storage
    .from("price-lists")
    .upload(trip.storage_path, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  // Bump updated_at so the "refreshed" time is visible.
  await supabase
    .from("trips")
    .update({ size_bytes: buffer.length })
    .eq("id", tripId);

  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}

export async function updateTripSheets(
  tripId: string,
  sheets: SheetSelection[]
) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const cleaned = sheets
    .filter(
      (s) =>
        Number.isInteger(s.index) &&
        s.index >= 0 &&
        typeof s.name === "string" &&
        (s.kind === "supplier" || s.kind === "other")
    )
    .map((s) => ({ index: s.index, name: s.name.trim(), kind: s.kind }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ selected_sheets: cleaned })
    .eq("id", tripId);
  if (error) throw new Error(error.message);

  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Only admins can delete trips");

  const supabase = await createClient();
  const { data: trip, error: fetchErr } = await supabase
    .from("trips")
    .select("id, storage_path")
    .eq("id", tripId)
    .single();
  if (fetchErr || !trip) throw new Error("Trip not found");

  const { error: rmErr } = await supabase.storage
    .from("price-lists")
    .remove([trip.storage_path]);
  if (rmErr) throw new Error(rmErr.message);

  const { error: delErr } = await supabase.from("trips").delete().eq("id", tripId);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/trips");
}
