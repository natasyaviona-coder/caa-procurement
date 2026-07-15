import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite, isAdmin } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { COMPETITOR_FIELDS } from "@/lib/competitor-fields";
import { PhotoPopout } from "@/components/photo-popout";
import { AssignProduct } from "@/components/assign-product";
import { assignCompetitorProductToProduct } from "../actions";
import { CompetitorHeaderActions, DeleteProductButton } from "./competitor-actions";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GRID = "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";

export default async function CompetitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: competitor, error: competitorErr } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", id)
    .single();
  if (competitorErr || !competitor) notFound();

  let productsQuery = supabase
    .from("competitor_products")
    .select("id, name, photo_url, product_url, fields, product_id")
    .eq("competitor_id", id)
    .order("name")
    .limit(1000);
  if (q?.trim()) productsQuery = productsQuery.ilike("name", `%${q.trim()}%`);
  const [{ data: products, error: productsErr }, ourProductsRes] = await Promise.all([
    productsQuery,
    supabase.from("products").select("id, sku, name").order("sku"),
  ]);
  const ourProducts = ourProductsRes.data ?? [];

  const writable = canWrite(profile.role);
  // photo + name + fields + link + (map + delete when writable)
  const colCount = 2 + COMPETITOR_FIELDS.length + 1 + (writable ? 2 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{competitor.name}</h1>
          <p className="text-sm text-muted-foreground">
            {competitor.specialization ? (
              <Badge className="bg-secondary text-secondary-foreground">
                {competitor.specialization}
              </Badge>
            ) : null}
            {competitor.notes ? <span className="ml-2">{competitor.notes}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {writable ? (
            <CompetitorHeaderActions
              competitorId={competitor.id}
              competitorName={competitor.name}
              canDelete={isAdmin(profile.role)}
            />
          ) : null}
          <LinkButton href="/competitors" variant="outline">
            Back
          </LinkButton>
        </div>
      </div>

      <form className="flex gap-2" action={`/competitors/${id}`}>
        <Input
          name="q"
          placeholder="Search products by name…"
          defaultValue={q ?? ""}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <LinkButton href={`/competitors/${id}`} variant="ghost">
            Clear
          </LinkButton>
        ) : null}
      </form>

      {productsErr ? (
        <p className="text-sm text-destructive">{productsErr.message}</p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {products?.length ?? 0} product{products?.length === 1 ? "" : "s"}
        {q ? " matching" : ""}. The yellow column is the target sourcing RMB
        (Reverse RMB - HPP Produk) from the file.
      </p>

      <div className="rounded-md border">
        <Table stickyHeader className={GRID}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 font-semibold">Foto Produk</TableHead>
              <TableHead className="font-semibold">Nama Produk</TableHead>
              {COMPETITOR_FIELDS.map((f) => (
                <TableHead
                  key={f.key}
                  className={cn(
                    "whitespace-nowrap font-semibold",
                    "highlight" in f && f.highlight && "bg-yellow-200 text-yellow-950"
                  )}
                >
                  {f.label}
                </TableHead>
              ))}
              <TableHead className="font-semibold">Link</TableHead>
              {writable ? (
                <TableHead className="font-semibold">Map to product</TableHead>
              ) : null}
              {writable ? <TableHead className="w-20"></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  {q
                    ? "No products match that search."
                    : "No products yet — upload their product list (.xlsx) to start."}
                </TableCell>
              </TableRow>
            ) : (
              products!.map((p) => {
                const fields = (p.fields ?? {}) as Record<string, string>;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="w-28">
                      {p.photo_url ? (
                        <PhotoPopout src={p.photo_url} />
                      ) : (
                        <div className="h-24 w-24 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-52 whitespace-pre-line text-xs font-medium">
                      {p.name}
                    </TableCell>
                    {COMPETITOR_FIELDS.map((f) => (
                      <TableCell
                        key={f.key}
                        className={cn(
                          "max-w-48 whitespace-pre-line text-xs align-top",
                          "highlight" in f &&
                            f.highlight &&
                            "bg-yellow-100 font-semibold text-yellow-950"
                        )}
                      >
                        {fields[f.key] || "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs">
                      {p.product_url ? (
                        <a
                          href={p.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          link
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {writable ? (
                      <TableCell className="align-top">
                        <AssignProduct
                          currentProductId={p.product_id}
                          products={ourProducts}
                          action={assignCompetitorProductToProduct.bind(null, p.id, id)}
                        />
                      </TableCell>
                    ) : null}
                    {writable ? (
                      <TableCell className="align-top">
                        <DeleteProductButton productId={p.id} competitorId={id} />
                      </TableCell>
                    ) : null}
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
