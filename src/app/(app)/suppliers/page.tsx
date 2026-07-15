import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { UploadSuppliers } from "./upload-suppliers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { labelOf, CONTACT_CHANNELS, SUPPLIER_PLATFORMS } from "@/lib/enums";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("suppliers")
    .select(
      "id, name, contact_channel, contact_handle, platform, typical_lead_time_days, updated_at"
    )
    .order("name", { ascending: true })
    .limit(500);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `name.ilike.${term},contact_handle.ilike.${term},payment_terms.ilike.${term}`
    );
  }

  const { data: suppliers, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            {suppliers?.length ?? 0} result{suppliers?.length === 1 ? "" : "s"}
          </p>
        </div>
        {canWrite(profile.role) ? (
          <div className="flex items-center gap-2">
            <UploadSuppliers />
            <LinkButton href="/suppliers/new">New supplier</LinkButton>
          </div>
        ) : null}
      </div>

      <form className="flex gap-2" action="/suppliers">
        <Input
          name="q"
          placeholder="Search name, contact, terms…"
          defaultValue={q ?? ""}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <LinkButton href="/suppliers" variant="ghost">
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
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Lead time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(suppliers ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No suppliers yet.
                </TableCell>
              </TableRow>
            ) : (
              suppliers!.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {labelOf(SUPPLIER_PLATFORMS, s.platform)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {labelOf(CONTACT_CHANNELS, s.contact_channel)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.contact_handle ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.typical_lead_time_days != null
                      ? `${s.typical_lead_time_days}d`
                      : "—"}
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
