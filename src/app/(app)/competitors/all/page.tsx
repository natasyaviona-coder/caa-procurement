import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhotoPopout } from "@/components/photo-popout";
import { CompetitorsTabs } from "../competitors-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  name: string;
  photo_url: string | null;
  price_idr: number | null;
  fields: Record<string, string>;
  competitor_id: string | null;
  competitors: { name: string } | { name: string }[] | null;
};

const SELECT =
  "id, name, photo_url, price_idr, fields, competitor_id, competitors(name)";

export default async function AllCompetitorProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let rows: Row[] = [];
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    const [byName, matchComps] = await Promise.all([
      supabase.from("competitor_products").select(SELECT).ilike("name", term).limit(1000),
      supabase.from("competitors").select("id").ilike("name", term),
    ]);
    const collected = new Map<string, Row>();
    for (const r of (byName.data ?? []) as Row[]) collected.set(r.id, r);
    const ids = (matchComps.data ?? []).map((c) => c.id);
    if (ids.length > 0) {
      const byComp = await supabase
        .from("competitor_products")
        .select(SELECT)
        .in("competitor_id", ids)
        .limit(1000);
      for (const r of (byComp.data ?? []) as Row[]) collected.set(r.id, r);
    }
    rows = [...collected.values()];
  } else {
    const { data } = await supabase
      .from("competitor_products")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(1000);
    rows = (data ?? []) as Row[];
  }

  const one = (v: Row["competitors"]) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="space-y-6">
      <CompetitorsTabs />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">All Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every product across all competitors. Search by product or competitor name.
        </p>
      </div>

      <form className="flex gap-2" action="/competitors/all">
        <Input
          name="q"
          placeholder="Search product or competitor name…"
          defaultValue={q ?? ""}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <LinkButton href="/competitors/all" variant="ghost">
            Clear
          </LinkButton>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground">
        {rows.length} product{rows.length === 1 ? "" : "s"}
        {q ? " matching" : ""}. The yellow column is the target sourcing RMB.
      </p>

      <div className="overflow-hidden rounded-md border">
        <Table stickyHeader>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Photo</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Competitor</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Target RMB</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {q ? "No products match that search." : "No competitor products yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const fields = (p.fields ?? {}) as Record<string, string>;
                const comp = one(p.competitors);
                const price =
                  fields.harga ||
                  (p.price_idr != null
                    ? `Rp ${Number(p.price_idr).toLocaleString("id-ID")}`
                    : "—");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="w-20">
                      {p.photo_url ? (
                        <PhotoPopout
                          src={p.photo_url}
                          className="h-14 w-14 rounded border object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-pre-line text-xs font-medium">
                      {p.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.competitor_id ? (
                        <Link
                          href={`/competitors/${p.competitor_id}`}
                          className="hover:underline"
                        >
                          {comp?.name ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">— unassigned —</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{price}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {fields.sold || "—"}
                    </TableCell>
                    <TableCell className="bg-yellow-100 text-right text-xs font-semibold tabular-nums text-yellow-950">
                      {fields.reverse_hpp ? `¥${fields.reverse_hpp}` : "—"}
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
