import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { BRANDS, labelOf } from "@/lib/enums";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, sku, name, brand, category, current_stock_on_hand, incoming_po_qty, photo_url"
    )
    .order("sku", { ascending: true })
    .limit(500);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `sku.ilike.${term},name.ilike.${term},category.ilike.${term}`
    );
  }

  const { data: products, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products?.length ?? 0} result{products?.length === 1 ? "" : "s"}
          </p>
        </div>
        {canWrite(profile.role) ? (
          <LinkButton href="/products/new">New product</LinkButton>
        ) : null}
      </div>

      <form className="flex gap-2" action="/products">
        <Input
          name="q"
          placeholder="Search SKU, name, category…"
          defaultValue={q ?? ""}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <LinkButton href="/products" variant="ghost">
            Clear
          </LinkButton>
        ) : null}
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <div className="rounded-md border">
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Incoming</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No products yet.
                </TableCell>
              </TableRow>
            ) : (
              products!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photo_url}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/products/${p.id}`}
                      className="hover:underline"
                    >
                      {p.sku}
                    </Link>
                  </TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{labelOf(BRANDS, p.brand)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.current_stock_on_hand}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.incoming_po_qty}
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
