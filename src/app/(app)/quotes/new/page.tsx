import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { QuoteForm } from "../quote-form";
import { createQuote } from "../actions";

export default async function NewQuotePage() {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/quotes");

  const supabase = await createClient();
  const [suppliersRes, productsRes] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name").order("sku"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New quote</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log a supplier&apos;s RMB price for a product.
        </p>
      </div>
      <QuoteForm
        suppliers={suppliersRes.data ?? []}
        products={productsRes.data ?? []}
        action={createQuote}
        submitLabel="Create quote"
      />
    </div>
  );
}
