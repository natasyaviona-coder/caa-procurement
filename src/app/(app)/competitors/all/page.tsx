import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompetitorsTabs } from "../competitors-tabs";
import { AllProductsTable, type AllProduct } from "./all-products-table";

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

  const products: AllProduct[] = rows.map((p) => {
    const fields = (p.fields ?? {}) as Record<string, string>;
    const comp = one(p.competitors);
    return {
      id: p.id,
      name: p.name,
      competitorId: p.competitor_id,
      competitorName: comp?.name ?? null,
      photoUrl: p.photo_url,
      price:
        fields.harga ||
        (p.price_idr != null
          ? `Rp ${Number(p.price_idr).toLocaleString("id-ID")}`
          : "—"),
      sold: fields.sold || "—",
      targetRmb: fields.reverse_hpp ? `¥${fields.reverse_hpp}` : "—",
      size: fields.ukuran || "",
    };
  });

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
        {products.length} product{products.length === 1 ? "" : "s"}
        {q ? " matching" : ""}. Tap a row for full details.
      </p>

      <AllProductsTable products={products} />
    </div>
  );
}
