import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite, isAdmin } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { FileActions } from "./file-actions";
import { TranslateButton } from "./translate-button";
import {
  listSheets,
  readSheet,
  sheetImageRows,
  type SheetGrid,
} from "@/lib/xlsx-view";
import {
  detectMapping,
  extractAssumptions,
  STANDARD_COLUMNS,
  type AssumptionRow,
  type ColumnMapping,
  type StandardKey,
} from "@/lib/pricelist-map";
import { StandardizedTable, type StdRow } from "./standardized-table";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Visible gridlines on every cell.
const GRID = "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";

// Mapped for matching, but not shown in the standardized view (per Nat).
const HIDDEN_KEYS: StandardKey[] = ["size", "carton_size"];

function formatAssumptionValue(label: string, value: string): string {
  const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n) || value.trim() === "") return value || "—";
  // Fractions and %-labelled values render as percentages (0.3 -> 30%).
  if (/%/.test(label) || (n > 0 && n < 1)) return `${Math.round(n * 100)}%`;
  return Math.round(n).toLocaleString("id-ID");
}

export default async function FileViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sheet?: string; raw?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { sheet, raw } = await searchParams;
  const supabase = await createClient();

  const [fileRes, suppliersRes] = await Promise.all([
    supabase
      .from("price_list_files")
      .select(
        "id, file_name, storage_path, created_at, supplier_id, translations, suppliers(name)"
      )
      .eq("id", id)
      .single(),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);
  const file = fileRes.data;
  if (fileRes.error || !file) notFound();
  const supplierRow = Array.isArray(file.suppliers)
    ? file.suppliers[0]
    : file.suppliers;
  const supplierName = supplierRow?.name ?? null;

  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(file.storage_path);

  let sheets: { index: number; name: string }[] = [];
  let grid: SheetGrid | null = null;
  let mapping: ColumnMapping | null = null;
  let assumptions: AssumptionRow[] = [];
  let imageRows = new Set<number>();
  let viewError: string | null = dlErr?.message ?? null;
  let sheetIndex = Math.max(0, Number(sheet ?? 0) || 0);

  if (blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      sheets = listSheets(buffer);
      if (sheetIndex >= sheets.length) sheetIndex = 0;
      grid = readSheet(buffer, sheetIndex);
      mapping = detectMapping(grid.rows);
      assumptions = extractAssumptions(grid.rows);
      imageRows = sheetImageRows(buffer, sheetIndex);
    } catch (err) {
      viewError = err instanceof Error ? err.message : "Could not parse this file";
    }
  }

  const showRaw = raw === "1" || !mapping;
  const allTranslations = (file.translations ?? {}) as Record<
    string,
    Record<string, string>
  >;
  const sheetTranslations = allTranslations[String(sheetIndex)] ?? {};
  const hasNameCol = mapping?.columns.name != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{file.file_name}</h1>
          <p className="text-sm text-muted-foreground">
            {supplierName ? `${supplierName} · ` : ""}Uploaded{" "}
            {new Date(file.created_at).toLocaleDateString("id-ID")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite(profile.role) && hasNameCol ? (
            <TranslateButton
              fileId={file.id}
              sheetIndex={sheetIndex}
              translated={Object.keys(sheetTranslations).length > 0}
            />
          ) : null}
          {canWrite(profile.role) ? (
            <FileActions
              fileId={file.id}
              fileName={file.file_name}
              currentSupplierId={file.supplier_id ?? null}
              suppliers={suppliersRes.data ?? []}
              canDelete={isAdmin(profile.role)}
            />
          ) : null}
          <LinkButton href="/quotes/files" variant="outline">
            Back to files
          </LinkButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b pb-2">
        {sheets.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {sheets.map((s) => (
              <Link
                key={s.index}
                href={`/quotes/files/${id}?sheet=${s.index}${raw === "1" ? "&raw=1" : ""}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  s.index === sheetIndex && "bg-muted font-medium text-foreground"
                )}
              >
                {s.name}
              </Link>
            ))}
          </div>
        ) : null}
        {mapping ? (
          <div className="ml-auto flex gap-1 text-sm">
            <Link
              href={`/quotes/files/${id}?sheet=${sheetIndex}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground",
                !showRaw && "bg-muted font-medium text-foreground"
              )}
            >
              Standardized
            </Link>
            <Link
              href={`/quotes/files/${id}?sheet=${sheetIndex}&raw=1`}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground",
                showRaw && "bg-muted font-medium text-foreground"
              )}
            >
              Raw sheet
            </Link>
          </div>
        ) : null}
      </div>

      {viewError ? <p className="text-sm text-destructive">{viewError}</p> : null}

      {grid && !mapping ? (
        <p className="text-xs text-muted-foreground">
          Column headers in this sheet weren&apos;t recognized, so it&apos;s shown
          as-is. If this is a real price list with new header names, they can be
          added to the mapping dictionary.
        </p>
      ) : null}

      {!showRaw && assumptions.length > 0 ? (
        <section className="rounded-md border bg-muted/20 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Assumptions (from file)
          </h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {assumptions.map((a) => (
              <div key={a.label}>
                <dt className="text-xs text-muted-foreground">{a.label}</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {formatAssumptionValue(a.label, a.value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {grid && mapping && !showRaw ? (
        <StandardizedSection
          fileId={id}
          sheetIndex={sheetIndex}
          grid={grid}
          mapping={mapping}
          imageRows={imageRows}
          translations={sheetTranslations}
        />
      ) : null}

      {grid && showRaw ? <RawView grid={grid} /> : null}
    </div>
  );
}

function StandardizedSection({
  fileId,
  sheetIndex,
  grid,
  mapping,
  imageRows,
  translations,
}: {
  fileId: string;
  sheetIndex: number;
  grid: SheetGrid;
  mapping: ColumnMapping;
  imageRows: Set<number>;
  translations: Record<string, string>;
}) {
  const visible = STANDARD_COLUMNS.filter(
    (c) =>
      c.key !== "image" &&
      !HIDDEN_KEYS.includes(c.key) &&
      mapping.columns[c.key] != null
  );

  const rows: StdRow[] = grid.rows
    .slice(mapping.headerRowIdx + 1)
    .map((r) => {
      const values: Record<string, string> = {};
      for (const c of visible) {
        const col = mapping.columns[c.key];
        values[c.key] = col != null ? (r.cells[col] ?? "") : "";
      }
      // hpp_landed is needed for the margin calc even though its column
      // config might be hidden in some file — always include when mapped.
      const landedCol = mapping.columns.hpp_landed;
      if (landedCol != null) values.hpp_landed = r.cells[landedCol] ?? "";
      return { rowNum: r.rowNum, hasImage: imageRows.has(r.rowNum), values };
    })
    .filter(
      (r) =>
        Boolean(r.values.model?.trim() || r.values.name?.trim()) || r.hasImage
    );

  const missing = STANDARD_COLUMNS.filter(
    (c) =>
      c.key !== "image" &&
      !HIDDEN_KEYS.includes(c.key) &&
      mapping.columns[c.key] == null
  );

  return (
    <div className="space-y-2">
      {grid.truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing first {rows.length} rows of {grid.totalRows}.
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Not present in this file: {missing.map((m) => m.label).join(", ")}.
        </p>
      ) : null}
      <StandardizedTable
        fileId={fileId}
        sheetIndex={sheetIndex}
        columns={visible.map((c) => ({ key: c.key, label: c.label }))}
        rows={rows}
        translations={translations}
      />
      <p className="text-xs text-muted-foreground">
        Est. Sell Price and Profit Margin are a calculator only — nothing you
        type here is saved.
      </p>
    </div>
  );
}

function RawView({ grid }: { grid: SheetGrid }) {
  return (
    <>
      {grid.truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing first {grid.rows.length} of {grid.totalRows} rows.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <Table className={GRID}>
          {grid.rows.length > 0 ? (
            <TableHeader>
              <TableRow>
                {grid.rows[0].cells.map((h, i) => (
                  <TableHead key={i} className="whitespace-nowrap">
                    {h || "—"}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          ) : null}
          <TableBody>
            {grid.rows.length <= 1 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, grid.rows[0]?.cells.length ?? 1)}
                  className="text-center text-muted-foreground"
                >
                  No data rows in this sheet.
                </TableCell>
              </TableRow>
            ) : (
              grid.rows.slice(1).map((row) => (
                <TableRow key={row.rowNum}>
                  {row.cells.map((cell, ci) => (
                    <TableCell key={ci} className="max-w-64 truncate text-xs">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
