import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { QuotesTabs } from "../quotes-tabs";
import { StartFoto } from "./start-foto";
import { AssignProduct } from "@/components/assign-product";
import { AssignSupplier } from "@/components/assign-supplier";
import { assignFieldQuoteProduct, assignFieldQuoteSupplier } from "./actions";
import { LinkButton } from "@/components/link-button";
import { computeFieldQuote } from "@/lib/field-calc";
import { formatIDR } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function QuotesFieldPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const profile = await requireProfile();
  const { supplier } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("field_quotes")
    .select(
      "id, product_id, product_name, photo_url, price_rmb, qty_per_carton, cbm, carton_p_cm, carton_l_cm, carton_t_cm, fx_rate, freight_per_cbm, admin_pct, order_fee, packaging_fee, est_sell_price, created_at, supplier_id, suppliers(name)"
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (supplier) query = query.eq("supplier_id", supplier);

  const [{ data: quotes, error }, suppliersRes, productsRes] = await Promise.all([
    query,
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, sku, name").order("sku"),
  ]);
  const productOptions = productsRes.data ?? [];
  const writable = canWrite(profile.role);

  const rows = (quotes ?? []).map((q) => {
    const s = Array.isArray(q.suppliers) ? q.suppliers[0] : q.suppliers;
    const calc = computeFieldQuote({
      priceRmb: q.price_rmb != null ? Number(q.price_rmb) : null,
      qtyPerCarton: q.qty_per_carton,
      cbm: q.cbm != null ? Number(q.cbm) : null,
      cartonP: q.carton_p_cm != null ? Number(q.carton_p_cm) : null,
      cartonL: q.carton_l_cm != null ? Number(q.carton_l_cm) : null,
      cartonT: q.carton_t_cm != null ? Number(q.carton_t_cm) : null,
      estSellPrice: q.est_sell_price != null ? Number(q.est_sell_price) : null,
      fxRate: Number(q.fx_rate),
      freightPerCbm: Number(q.freight_per_cbm),
      adminPct: Number(q.admin_pct),
      orderFee: Number(q.order_fee),
      packagingFee: Number(q.packaging_fee),
    });
    return { ...q, supplierName: s?.name ?? "—", calc };
  });

  return (
    <div className="space-y-6">
      <QuotesTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Quotes Field</h1>
          <p className="text-sm text-muted-foreground">
            Quick quotes captured at the supplier — photo, price, live landed HPP.
          </p>
        </div>
        {canWrite(profile.role) ? (
          <StartFoto suppliers={suppliersRes.data ?? []} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex gap-2" action="/quotes/field">
          <select
            name="supplier"
            defaultValue={supplier ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All suppliers</option>
            {(suppliersRes.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
          >
            Filter
          </button>
        </form>
        {supplier ? (
          <>
            <LinkButton
              href={`/quotes/field/export?supplier=${supplier}`}
              variant="outline"
              size="sm"
            >
              Export .xlsx
            </LinkButton>
            <LinkButton href="/quotes/field" variant="ghost" size="sm">
              Clear
            </LinkButton>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Filter by one supplier to export their quotation as .xlsx.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <Table className="[&_th]:border [&_td]:border">
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Map to product</TableHead>
              <TableHead className="text-right">RMB</TableHead>
              <TableHead className="text-right">Qty/Ctn</TableHead>
              <TableHead className="text-right">CBM</TableHead>
              <TableHead className="text-right">HPP Landed</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Nothing captured yet — click Start foto.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="w-16">
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo_url}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 rounded object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.supplier_id ? (
                      <Link
                        href={`/quotes/field?supplier=${r.supplier_id}`}
                        className="hover:underline"
                      >
                        {r.supplierName}
                      </Link>
                    ) : writable ? (
                      <AssignSupplier
                        currentSupplierId={null}
                        suppliers={suppliersRes.data ?? []}
                        action={assignFieldQuoteSupplier.bind(null, r.id)}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 text-xs">
                    {r.product_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {writable ? (
                      <AssignProduct
                        currentProductId={r.product_id}
                        products={productOptions}
                        action={assignFieldQuoteProduct.bind(null, r.id)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {productOptions.find((p) => p.id === r.product_id)?.sku ?? "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.price_rmb != null ? Number(r.price_rmb).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.qty_per_carton ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.calc.cbmEffective != null
                      ? r.calc.cbmEffective.toFixed(4)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.calc.hppLanded != null ? formatIDR(r.calc.hppLanded) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.calc.marginSimple != null
                      ? `${(r.calc.marginSimple * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("id-ID")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
