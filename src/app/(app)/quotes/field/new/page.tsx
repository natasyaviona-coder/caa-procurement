import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { QuotesTabs } from "../../quotes-tabs";
import { LinkButton } from "@/components/link-button";
import { CaptureForm } from "./capture-form";

export default async function NewFieldQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/quotes/field");

  const { supplier } = await searchParams;

  // Supplier is optional — you can capture now and assign the supplier later
  // from the Quotes Field list.
  let supplierRow: { id: string; name: string } | null = null;
  if (supplier) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("id", supplier)
      .single();
    supplierRow = data ?? null;
  }

  return (
    <div className="space-y-6">
      <QuotesTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Foto — {supplierRow ? supplierRow.name : "no supplier yet"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {supplierRow
              ? "Capture item → price → live HPP. Save, then capture the next one."
              : "Capture now — assign the supplier later from the list. The business card needs a supplier, so add it after assigning."}
          </p>
        </div>
        <LinkButton href="/quotes/field" variant="outline">
          Done / back to list
        </LinkButton>
      </div>
      <CaptureForm supplier={supplierRow} />
    </div>
  );
}
