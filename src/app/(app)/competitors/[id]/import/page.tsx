import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { listSheets, readSheet, indexToCol } from "@/lib/xlsx-view";
import { readCompetitorTemplate } from "@/lib/competitor-template";
import { MappingForm } from "./mapping-form";
import { TemplateImport } from "./template-import";

// Header-keyword guesses for the two important columns.
function guessColumns(header: string[]): { nameCol: number; priceCol: number | null } {
  const norm = header.map((h) => h.toLowerCase());
  const findIdx = (patterns: RegExp[]) =>
    norm.findIndex((h) => patterns.some((p) => p.test(h)));
  const nameCol = findIdx([/name/, /nama/, /produk/, /product/, /item/, /barang/]);
  const priceCol = findIdx([/price/, /harga/, /idr/, /rp\b/, /jual/]);
  return {
    nameCol: nameCol >= 0 ? nameCol : 0,
    priceCol: priceCol >= 0 ? priceCol : null,
  };
}

export default async function CompetitorImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string; file?: string; sheet?: string }>;
}) {
  const { id } = await params;
  const { path, file, sheet } = await searchParams;
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect(`/competitors/${id}`);
  if (!path || !file) redirect(`/competitors/${id}`);

  const supabase = await createClient();
  const [competitorRes, settingsRes, blobRes] = await Promise.all([
    supabase.from("competitors").select("id, name").eq("id", id).single(),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.storage.from("price-lists").download(path),
  ]);
  if (competitorRes.error || !competitorRes.data) notFound();

  const assumptions = {
    fxRate: settingsRes.data?.fx_rate_rmb_idr ?? 2700,
    adminPct: settingsRes.data?.default_admin_pct ?? 0.3,
    targetMarginPct: settingsRes.data?.default_target_margin_pct ?? 0.3,
  };

  let parseError: string | null = blobRes.error?.message ?? null;
  let sheets: { index: number; name: string }[] = [];
  let columns: { index: number; label: string }[] = [];
  let sampleRows: string[][] = [];
  let headerRowIdx = 0;
  let guess = { nameCol: 0, priceCol: null as number | null };
  const activeSheet = Number(sheet ?? 0) || 0;

  // If the file matches the CAA competitor template, offer one-click import.
  let template: {
    fxRate: number | null;
    totalRows: number;
    sample: { name: string; fields: Record<string, string> }[];
  } | null = null;

  if (blobRes.data) {
    try {
      const buffer = Buffer.from(await blobRes.data.arrayBuffer());
      sheets = listSheets(buffer);
      const safeSheet = activeSheet < sheets.length ? activeSheet : 0;

      const tpl = readCompetitorTemplate(buffer, safeSheet);
      if (tpl.detected && tpl.rows.length > 0) {
        template = {
          fxRate: tpl.fxRate,
          totalRows: tpl.rows.length,
          sample: tpl.rows.slice(0, 6).map((r) => ({ name: r.name, fields: r.fields })),
        };
      }

      const grid = readSheet(buffer, safeSheet, { maxRows: 30 });
      // First non-empty row is treated as the header.
      const header = grid.rows[0]?.cells ?? [];
      headerRowIdx = 0;
      columns = header.map((h, i) => ({
        index: i,
        label: `${indexToCol(i + 1)} · ${h || "(empty)"}`,
      }));
      sampleRows = grid.rows.slice(1).map((r) => r.cells);
      guess = guessColumns(header);
    } catch (err) {
      parseError = err instanceof Error ? err.message : "Could not read the file";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Import products → {competitorRes.data.name}
          </h1>
          <p className="text-sm text-muted-foreground">{file}</p>
        </div>
        <LinkButton href={`/competitors/${id}`} variant="outline">
          Cancel
        </LinkButton>
      </div>

      {parseError ? (
        <p className="text-sm text-destructive">{parseError}</p>
      ) : template ? (
        <TemplateImport
          competitorId={id}
          storagePath={path}
          fileName={file}
          sheetIndex={activeSheet < sheets.length ? activeSheet : 0}
          fxRate={template.fxRate}
          totalRows={template.totalRows}
          sample={template.sample}
        />
      ) : columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No columns found in this sheet.</p>
      ) : (
        <MappingForm
          competitorId={id}
          storagePath={path}
          fileName={file}
          sheets={sheets}
          activeSheet={activeSheet < sheets.length ? activeSheet : 0}
          columns={columns}
          headerRowIdx={headerRowIdx}
          sampleRows={sampleRows}
          guess={guess}
          assumptions={assumptions}
        />
      )}
    </div>
  );
}
