import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BulkImportCompetitors } from "./bulk-import";
import { PhotoPopout } from "@/components/photo-popout";
import { AssignCompetitor } from "@/components/assign-competitor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("competitors")
    .select("id, name, specialization")
    .order("name");
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name.ilike.${term},specialization.ilike.${term}`);
  }

  const [{ data: competitors, error }, countsRes, unassignedRes, allCompsRes] =
    await Promise.all([
      query,
      supabase.from("competitor_products").select("competitor_id"),
      supabase
        .from("competitor_products")
        .select("id, name, photo_url, price_idr, fields")
        .is("competitor_id", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("competitors").select("id, name").order("name"),
    ]);

  const counts = new Map<string, number>();
  for (const r of countsRes.data ?? []) {
    if (r.competitor_id) {
      counts.set(r.competitor_id, (counts.get(r.competitor_id) ?? 0) + 1);
    }
  }

  const unassigned = unassignedRes.data ?? [];
  const allCompetitors = allCompsRes.data ?? [];
  const writable = canWrite(profile.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Competitors</h1>
          <p className="text-sm text-muted-foreground">
            One card per competitor. Click a name to see their product list and
            each product&apos;s target sourcing RMB.
          </p>
        </div>
        {writable ? (
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href="/competitors/bulk-pictures" variant="outline">
              Bulk upload pictures
            </LinkButton>
            <BulkImportCompetitors />
            <LinkButton href="/competitors/new">New competitor</LinkButton>
          </div>
        ) : null}
      </div>

      <form className="flex gap-2" action="/competitors">
        <Input
          name="q"
          placeholder="Search competitor or specialization…"
          defaultValue={q ?? ""}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <LinkButton href="/competitors" variant="ghost">
            Clear
          </LinkButton>
        ) : null}
      </form>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      {writable && unassigned.length > 0 ? (
        <section className="space-y-3 rounded-md border border-brand/30 bg-brand/5 p-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Unassigned pictures ({unassigned.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Bulk-uploaded market pictures not yet filed under a competitor.
              Pick a competitor for each to move it into their list.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassigned.map((p) => {
              const fields = (p.fields ?? {}) as Record<string, string>;
              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-md border bg-background p-2"
                >
                  {p.photo_url ? (
                    <PhotoPopout
                      src={p.photo_url}
                      className="h-16 w-16 shrink-0 rounded border object-contain"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate text-xs font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fields.harga || "—"}
                      {fields.reverse_hpp ? ` · ¥${fields.reverse_hpp}` : ""}
                    </div>
                    <AssignCompetitor productId={p.id} competitors={allCompetitors} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {(competitors ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No competitors yet. Add one, then upload their product list.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitors!.map((c) => (
            <Link key={c.id} href={`/competitors/${c.id}`} className="group">
              <Card className="transition-colors group-hover:border-foreground/20">
                <CardHeader>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <CardDescription>
                    {c.specialization ? (
                      <Badge className="bg-secondary text-secondary-foreground">
                        {c.specialization}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {counts.get(c.id) ?? 0} product
                    {counts.get(c.id) === 1 ? "" : "s"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
