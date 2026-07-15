import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { QuoteForm } from "../quote-form";
import { updateQuote } from "../actions";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [quoteRes, suppliersRes, productsRes] = await Promise.all([
    supabase.from("supplier_quotes").select("*").eq("id", id).single(),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name").order("sku"),
  ]);

  if (quoteRes.error || !quoteRes.data) notFound();
  const quote = quoteRes.data;

  const boundUpdate = async (formData: FormData) => {
    "use server";
    await updateQuote(id, formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Quote {quote.quote_date}</h1>
          <p className="text-sm text-muted-foreground">
            RMB {Number(quote.rmb_price).toFixed(2)}
            {quote.moq ? ` · MOQ ${quote.moq}` : ""}
          </p>
        </div>
        <LinkButton href="/quotes" variant="outline">
          Back
        </LinkButton>
      </div>

      {canWrite(profile.role) ? (
        <QuoteForm
          initial={quote}
          suppliers={suppliersRes.data ?? []}
          products={productsRes.data ?? []}
          action={boundUpdate}
          submitLabel="Save changes"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Viewer role — read only.
        </p>
      )}
    </div>
  );
}
