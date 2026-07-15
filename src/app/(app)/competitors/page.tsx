import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BulkImportCompetitors } from "./bulk-import";
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

  const [{ data: competitors, error }, countsRes] = await Promise.all([
    query,
    supabase.from("competitor_products").select("competitor_id"),
  ]);

  const counts = new Map<string, number>();
  for (const r of countsRes.data ?? []) {
    counts.set(r.competitor_id, (counts.get(r.competitor_id) ?? 0) + 1);
  }

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
        {canWrite(profile.role) ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <BulkImportCompetitors />
              <LinkButton href="/competitors/new">New competitor</LinkButton>
            </div>
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
