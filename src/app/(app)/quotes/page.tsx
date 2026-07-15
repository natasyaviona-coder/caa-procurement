import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QuotesTabs } from "./quotes-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One unified quote row, whichever context it came from.
type UnifiedRow = {
  id: string;
  kind: "manual" | "field";
  date: string;
  supplierId: string;
  supplierName: string;
  productId: string | null;
  rmb: number | null;
  moq: number | null;
  sourceFile: string | null;
  href: string;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; supplier?: string; product?: string; file?: string }>;
}) {
  const profile = await requireProfile();
  const { q, supplier, product, file } = await searchParams;
  const supabase = await createClient();

  // --- supplier_quotes (manual / file-sourced grid quotes) ---
  let manualQuery = supabase
    .from("supplier_quotes")
    .select(
      "id, quote_date, rmb_price, moq, notes, source_file, supplier_id, product_id, suppliers(name)"
    )
    .order("quote_date", { ascending: false })
    .limit(500);
  if (supplier) manualQuery = manualQuery.eq("supplier_id", supplier);
  if (product) manualQuery = manualQuery.eq("product_id", product);
  if (file) manualQuery = manualQuery.eq("source_file", file);
  if (q?.trim()) manualQuery = manualQuery.ilike("notes", `%${q.trim()}%`);

  // --- field_quotes (captured on the grid at the supplier) ---
  // Skipped when filtering by a source file or notes text — those are
  // supplier_quotes-only concepts.
  const includeField = !file && !q?.trim();
  let fieldQuery = includeField
    ? supabase
        .from("field_quotes")
        .select(
          "id, created_at, price_rmb, product_id, supplier_id, suppliers(name)"
        )
        .order("created_at", { ascending: false })
        .limit(500)
    : null;
  if (fieldQuery && supplier) fieldQuery = fieldQuery.eq("supplier_id", supplier);
  if (fieldQuery && product) fieldQuery = fieldQuery.eq("product_id", product);

  // --- competitor market benchmark (only once a product is picked) ---
  const marketQuery = product
    ? supabase
        .from("competitor_products")
        .select("id, name, price_idr, fields, competitor_id, competitors(name)")
        .eq("product_id", product)
        .limit(200)
    : null;

  const [manualRes, fieldRes, suppliersRes, productsRes, filesRes, marketRes] =
    await Promise.all([
      manualQuery,
      fieldQuery,
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name").order("sku"),
      supabase.from("supplier_quotes").select("source_file").not("source_file", "is", null),
      marketQuery,
    ]);

  const error = manualRes.error;

  const sourceFiles = [
    ...new Set((filesRes.data ?? []).map((r) => r.source_file).filter(Boolean)),
  ].sort() as string[];

  // Merge both quote sources into one list.
  const rows: UnifiedRow[] = [];
  for (const m of manualRes.data ?? []) {
    const s = one(m.suppliers);
    rows.push({
      id: m.id,
      kind: "manual",
      date: m.quote_date,
      supplierId: m.supplier_id,
      supplierName: s?.name ?? "—",
      productId: m.product_id,
      rmb: m.rmb_price != null ? Number(m.rmb_price) : null,
      moq: m.moq,
      sourceFile: m.source_file,
      href: `/quotes/${m.id}`,
    });
  }
  for (const f of fieldRes?.data ?? []) {
    const s = one(f.suppliers);
    rows.push({
      id: f.id,
      kind: "field",
      date: (f.created_at ?? "").slice(0, 10),
      supplierId: f.supplier_id,
      supplierName: s?.name ?? "—",
      productId: f.product_id,
      rmb: f.price_rmb != null ? Number(f.price_rmb) : null,
      moq: null,
      sourceFile: null,
      href: `/quotes/field?supplier=${f.supplier_id}`,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Cross-supplier comparison for the selected product: cheapest RMB first,
  // one row per quote (field + manual), latest per supplier kept.
  const compareRows = product
    ? [...rows]
        .filter((r) => r.productId === product && r.rmb != null)
        .sort((a, b) => (a.rmb! - b.rmb!))
    : [];

  // Competitor market benchmark rows for the selected product.
  const marketRows = (marketRes?.data ?? []).map((c) => {
    const comp = one(c.competitors);
    const fields = (c.fields ?? {}) as Record<string, string>;
    return {
      id: c.id,
      competitorId: c.competitor_id,
      competitorName: comp?.name ?? "—",
      productName: c.name,
      price: fields.harga || (c.price_idr != null ? `Rp ${Number(c.price_idr).toLocaleString("id-ID")}` : "—"),
      sold: fields.sold || "—",
      targetRmb: fields.reverse_hpp || "—",
    };
  });

  const selectedProduct = productsRes.data?.find((p) => p.id === product);
  const writable = canWrite(profile.role);

  return (
    <div className="space-y-6">
      <QuotesTabs />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Quotes</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} quote{rows.length === 1 ? "" : "s"} · field + manual, all
            suppliers. Pick a product to compare across suppliers &amp; the market.
          </p>
        </div>
        {writable ? <LinkButton href="/quotes/new">New quote</LinkButton> : null}
      </div>

      <form className="flex flex-wrap gap-2" action="/quotes">
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
        <select
          name="product"
          defaultValue={product ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">All products</option>
          {(productsRes.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
        <select
          name="file"
          defaultValue={file ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">All files</option>
          {sourceFiles.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <Input
          name="q"
          placeholder="Search notes…"
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {q || supplier || product || file ? (
          <LinkButton href="/quotes" variant="ghost">
            Clear
          </LinkButton>
        ) : null}
      </form>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      {product && !selectedProduct ? null : product ? (
        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Compare across suppliers
            {selectedProduct ? (
              <span className="ml-2 normal-case text-foreground">
                · {selectedProduct.sku} · {selectedProduct.name}
              </span>
            ) : null}
          </h2>
          {compareRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quotes are mapped to this product yet. Tag quotes to it from
              Quotes Field (Map to product) or a supplier quote&apos;s product.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">RMB</TableHead>
                    <TableHead className="text-right">MOQ</TableHead>
                    <TableHead className="text-right">Quote date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareRows.map((r, i) => (
                    <TableRow key={`${r.kind}-${r.id}`}>
                      <TableCell>
                        <Link
                          href={`/suppliers/${r.supplierId}`}
                          className="hover:underline"
                        >
                          {r.supplierName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.kind === "field" ? "Field" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i === 0 ? (
                          <Badge className="bg-primary text-primary-foreground">
                            ¥{r.rmb!.toFixed(2)} lowest
                          </Badge>
                        ) : (
                          `¥${r.rmb!.toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.moq ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <h2 className="pt-2 text-sm font-semibold uppercase text-muted-foreground">
            Market (competitors)
          </h2>
          {marketRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competitor products mapped to this product. Tag them from a
              competitor&apos;s page (Map to product) to see market price &amp;
              units sold here.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Their product</TableHead>
                    <TableHead className="text-right">Market price</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Target RMB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketRows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link
                          href={`/competitors/${m.competitorId}`}
                          className="hover:underline"
                        >
                          {m.competitorName}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-52 whitespace-pre-line text-xs">
                        {m.productName}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {m.price}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {m.sold}
                      </TableCell>
                      <TableCell className="bg-yellow-100 text-right text-xs font-semibold tabular-nums text-yellow-950">
                        {m.targetRmb}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">RMB</TableHead>
              <TableHead className="text-right">MOQ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No quotes yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const p = productsRes.data?.find((x) => x.id === r.productId);
                return (
                  <TableRow key={`${r.kind}-${r.id}`}>
                    <TableCell>
                      <Link href={r.href} className="hover:underline">
                        {r.date}
                      </Link>
                    </TableCell>
                    <TableCell>{r.supplierName}</TableCell>
                    <TableCell>
                      {r.productId && p ? (
                        <>
                          <span className="font-mono text-xs">{p.sku}</span>
                          <span className="text-muted-foreground"> · </span>
                          {p.name}
                        </>
                      ) : (
                        <span className="text-muted-foreground">— unmapped —</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.kind === "field" ? "Field" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.rmb != null ? r.rmb.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.moq ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
