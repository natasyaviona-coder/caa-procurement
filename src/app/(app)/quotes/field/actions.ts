"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canWrite, requireProfile } from "@/lib/auth";

// Tag a field quote to a shared product (or clear it) so it joins the
// cross-supplier comparison in All Quotes. Pass null to unmap.
export async function assignFieldQuoteProduct(
  quoteId: string,
  productId: string | null
): Promise<void> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase
    .from("field_quotes")
    .update({ product_id: productId })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes/field");
  revalidatePath("/quotes");
}

// Assign (or change) the supplier on a field quote after the fact — for quotes
// captured before the supplier was known. Pass null to clear it.
export async function assignFieldQuoteSupplier(
  quoteId: string,
  supplierId: string | null
): Promise<void> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase
    .from("field_quotes")
    .update({ supplier_id: supplierId })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes/field");
  revalidatePath("/quotes");
}

// "Start foto" step: resolve the supplier before entering the capture form.
// Reuses an existing same-named supplier (case-insensitive) instead of
// duplicating; creates it when genuinely new.
export async function startFieldSession(input: {
  supplierId?: string | null;
  newSupplierName?: string | null;
}): Promise<{ supplierId: string }> {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  let supplierId = input.supplierId?.trim() || null;
  const newName = input.newSupplierName?.trim() || null;

  const supabase = await createClient();
  if (!supplierId && newName) {
    const { data: existing } = await supabase
      .from("suppliers")
      .select("id")
      .ilike("name", newName)
      .maybeSingle();
    if (existing) {
      supplierId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("suppliers")
        .insert({ name: newName })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      supplierId = created.id;
      revalidatePath("/suppliers");
    }
  }
  if (!supplierId) throw new Error("Pick a supplier or type a new supplier name");
  return { supplierId };
}

export type SaveFieldQuoteInput = {
  supplierId: string | null;
  productName: string | null;
  photoUrl: string | null;
  businessCardUrl: string | null;
  priceRmb: number | null;
  qtyPerCarton: number | null;
  cartonP: number | null;
  cartonL: number | null;
  cartonT: number | null;
  cbm: number | null;
  sizeP: number | null;
  sizeL: number | null;
  sizeT: number | null;
  fxRate: number;
  freightPerCbm: number;
  adminPct: number; // fraction, e.g. 0.3
  orderFee: number;
  packagingFee: number;
  estSellPrice: number | null;
  notes: string | null;
};

export async function saveFieldQuote(input: SaveFieldQuoteInput) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");
  if (input.priceRmb == null && !input.photoUrl) {
    throw new Error("Add at least a price or a product photo");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("field_quotes").insert({
    supplier_id: input.supplierId,
    product_name: input.productName?.trim() || null,
    photo_url: input.photoUrl,
    price_rmb: input.priceRmb,
    qty_per_carton: input.qtyPerCarton,
    carton_p_cm: input.cartonP,
    carton_l_cm: input.cartonL,
    carton_t_cm: input.cartonT,
    cbm: input.cbm,
    size_p_cm: input.sizeP,
    size_l_cm: input.sizeL,
    size_t_cm: input.sizeT,
    fx_rate: input.fxRate,
    freight_per_cbm: input.freightPerCbm,
    admin_pct: input.adminPct,
    order_fee: input.orderFee,
    packaging_fee: input.packagingFee,
    est_sell_price: input.estSellPrice,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);

  // A business card belongs to the supplier record, not the quote — so it can
  // only be stored once a supplier is set.
  if (input.businessCardUrl && input.supplierId) {
    await supabase
      .from("suppliers")
      .update({ business_card_url: input.businessCardUrl })
      .eq("id", input.supplierId);
    revalidatePath(`/suppliers/${input.supplierId}`);
  }

  revalidatePath("/quotes/field");
}

export async function deleteFieldQuote(id: string) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) throw new Error("Not permitted");

  const supabase = await createClient();
  const { error } = await supabase.from("field_quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/quotes/field");
}
