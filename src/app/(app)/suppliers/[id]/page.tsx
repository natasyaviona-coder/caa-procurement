import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { SupplierForm } from "../supplier-form";
import { updateSupplier } from "../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [supplierRes, quotesRes] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).single(),
    supabase
      .from("supplier_quotes")
      .select(
        "id, quote_date, rmb_price, moq, product_id, notes, products(sku, name)"
      )
      .eq("supplier_id", id)
      .order("quote_date", { ascending: false })
      .limit(20),
  ]);

  if (supplierRes.error || !supplierRes.data) notFound();
  const supplier = supplierRes.data;
  const quotes = quotesRes.data ?? [];

  const boundUpdate = async (formData: FormData) => {
    "use server";
    await updateSupplier(id, formData);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">Supplier detail</p>
        </div>
        <LinkButton href="/suppliers" variant="outline">
          Back
        </LinkButton>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Details
        </h2>
        {canWrite(profile.role) ? (
          <SupplierForm
            initial={supplier}
            action={boundUpdate}
            submitLabel="Save changes"
          />
        ) : (
          <ReadOnlyDetail supplier={supplier} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Recent quotes ({quotes.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">RMB</TableHead>
                <TableHead className="text-right">MOQ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No quotes yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => {
                  const p = Array.isArray(q.products) ? q.products[0] : q.products;
                  return (
                    <TableRow key={q.id}>
                      <TableCell>{q.quote_date}</TableCell>
                      <TableCell>
                        {q.product_id && p
                          ? `${p.sku} · ${p.name}`
                          : "— unmapped —"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(q.rmb_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {q.moq ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function ReadOnlyDetail({
  supplier,
}: {
  supplier: {
    name: string;
    contact_channel: string | null;
    contact_handle: string | null;
    platform: string | null;
    payment_terms: string | null;
    typical_lead_time_days: number | null;
    reliability_notes: string | null;
  };
}) {
  const rows: [string, string | number | null][] = [
    ["Contact channel", supplier.contact_channel],
    ["Contact handle", supplier.contact_handle],
    ["Platform", supplier.platform],
    ["Payment terms", supplier.payment_terms],
    ["Lead time (days)", supplier.typical_lead_time_days],
    ["Reliability notes", supplier.reliability_notes],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
          <dd className="text-sm">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
