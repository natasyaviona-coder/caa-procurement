import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { ProductForm } from "../product-form";
import { updateProduct } from "../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [productRes, quotesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("supplier_quotes")
      .select(
        "id, quote_date, rmb_price, moq, supplier_id, suppliers(name)"
      )
      .eq("product_id", id)
      .order("quote_date", { ascending: false })
      .limit(20),
  ]);

  if (productRes.error || !productRes.data) notFound();
  const product = productRes.data;
  const quotes = quotesRes.data ?? [];

  const boundUpdate = async (formData: FormData) => {
    "use server";
    await updateProduct(id, formData);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">{product.sku}</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
        <LinkButton href="/products" variant="outline">
          Back
        </LinkButton>
      </div>

      {product.photo_url ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.photo_url}
            alt={product.name}
            className="max-h-64 rounded-md border object-contain"
          />
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Details
        </h2>
        {canWrite(profile.role) ? (
          <ProductForm
            initial={product}
            action={boundUpdate}
            submitLabel="Save changes"
          />
        ) : (
          <ReadOnlyDetail product={product} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Recent quotes for this SKU ({quotes.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">RMB</TableHead>
                <TableHead className="text-right">MOQ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No quotes for this product yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => {
                  const s = Array.isArray(q.suppliers)
                    ? q.suppliers[0]
                    : q.suppliers;
                  return (
                    <TableRow key={q.id}>
                      <TableCell>{q.quote_date}</TableCell>
                      <TableCell>
                        <Link
                          href={`/suppliers/${q.supplier_id}`}
                          className="hover:underline"
                        >
                          {s?.name ?? "—"}
                        </Link>
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
  product,
}: {
  product: {
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    spec_summary: string | null;
    current_stock_on_hand: number;
    incoming_po_qty: number;
  };
}) {
  const rows: [string, string | number | null][] = [
    ["Brand", product.brand],
    ["Category", product.category],
    ["Spec", product.spec_summary],
    ["Stock", product.current_stock_on_hand],
    ["Incoming", product.incoming_po_qty],
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
