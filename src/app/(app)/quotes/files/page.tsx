import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { QuotesTabs } from "../quotes-tabs";
import { UploadForm } from "./upload-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type SortKey = "supplier" | "date";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  className?: string;
}) {
  const active = currentSort === sortKey;
  // Clicking an active column flips direction; a new column starts ascending
  // (except date, where newest-first is the useful default).
  const nextDir: SortDir = active
    ? currentDir === "asc"
      ? "desc"
      : "asc"
    : sortKey === "date"
      ? "desc"
      : "asc";
  return (
    <TableHead className={className}>
      <Link
        href={`/quotes/files?sort=${sortKey}&dir=${nextDir}`}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <span className="text-xs">{active ? (currentDir === "asc" ? "▲" : "▼") : ""}</span>
      </Link>
    </TableHead>
  );
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const profile = await requireProfile();
  const { sort: sortParam, dir: dirParam } = await searchParams;
  const sort: SortKey = sortParam === "supplier" ? "supplier" : "date";
  const dir: SortDir = dirParam === "asc" ? "asc" : "desc";

  const supabase = await createClient();
  const [filesRes, suppliersRes] = await Promise.all([
    supabase
      .from("price_list_files")
      .select("id, file_name, size_bytes, created_at, supplier_id, suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const files = (filesRes.data ?? []).map((f) => {
    const s = Array.isArray(f.suppliers) ? f.suppliers[0] : f.suppliers;
    return { ...f, supplierName: s?.name ?? "" };
  });

  files.sort((a, b) => {
    const cmp =
      sort === "supplier"
        ? a.supplierName.localeCompare(b.supplierName) ||
          a.created_at.localeCompare(b.created_at)
        : a.created_at.localeCompare(b.created_at);
    return dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <QuotesTabs />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Quotes File</h1>
          <p className="text-sm text-muted-foreground">
            Upload a supplier .xlsx, then click it to view its sheets. Translate
            Chinese files first (pricelisttranslate) — the viewer shows whatever
            language is in the file.
          </p>
        </div>
        {canWrite(profile.role) ? (
          <UploadForm suppliers={suppliersRes.data ?? []} />
        ) : null}
      </div>

      {filesRes.error ? (
        <p className="text-sm text-destructive">{filesRes.error.message}</p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader
                label="Supplier"
                sortKey="supplier"
                currentSort={sort}
                currentDir={dir}
              />
              <TableHead>File</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <SortHeader
                label="Uploaded"
                sortKey="date"
                currentSort={sort}
                currentDir={dir}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No files uploaded yet.
                </TableCell>
              </TableRow>
            ) : (
              files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    {f.supplier_id ? (
                      <Link
                        href={`/suppliers/${f.supplier_id}`}
                        className="hover:underline"
                      >
                        {f.supplierName || "—"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/quotes/files/${f.id}`} className="font-medium hover:underline">
                      {f.file_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(f.size_bytes)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("id-ID")}
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
