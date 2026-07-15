import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { listSheets, readSheet, indexToCol } from "@/lib/xlsx-view";
import { SupplierMappingForm } from "./mapping-form";

function guessColumns(header: string[]) {
  const norm = header.map((h) => h.toLowerCase());
  const find = (patterns: RegExp[]) =>
    norm.findIndex((h) => patterns.some((p) => p.test(h)));
  // "nama" alone → name; contact = wechat/hp/kontak; lead time; TOP/cash; address.
  const nameCol = find([/^nama$/, /nama\s*(toko|supplier|pt)/, /supplier\s*name/, /^name$/, /nama/]);
  const contactCol = find([/kontak/, /contact/, /wechat/, /telp/, /phone/, /hp\b/, /wa\b/]);
  const leadTimeCol = find([/lead/, /waktu/, /hari/, /days/]);
  const paymentCol = find([/top/, /cash/, /payment/, /term/, /bayar/, /tempo/]);
  const addressCol = find([/alamat/, /address/, /lokasi/, /location/]);
  return {
    nameCol: nameCol >= 0 ? nameCol : 0,
    contactCol: contactCol >= 0 ? contactCol : null,
    leadTimeCol: leadTimeCol >= 0 ? leadTimeCol : null,
    paymentCol: paymentCol >= 0 ? paymentCol : null,
    addressCol: addressCol >= 0 ? addressCol : null,
  };
}

export default async function SupplierImportPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; file?: string; sheet?: string }>;
}) {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/suppliers");
  const { path, file, sheet } = await searchParams;
  if (!path || !file) redirect("/suppliers");

  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage
    .from("price-lists")
    .download(path);

  let parseError: string | null = error?.message ?? null;
  let columns: { index: number; label: string }[] = [];
  let sampleRows: string[][] = [];
  let guess = {
    nameCol: 0,
    contactCol: null as number | null,
    leadTimeCol: null as number | null,
    paymentCol: null as number | null,
    addressCol: null as number | null,
  };
  const activeSheet = Number(sheet ?? 0) || 0;

  if (blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const sheets = listSheets(buffer);
      const safe = activeSheet < sheets.length ? activeSheet : 0;
      const grid = readSheet(buffer, safe, { maxRows: 30 });
      const header = grid.rows[0]?.cells ?? [];
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
          <h1 className="text-xl font-semibold tracking-tight">Import suppliers</h1>
          <p className="text-sm text-muted-foreground">{file}</p>
        </div>
        <LinkButton href="/suppliers" variant="outline">
          Cancel
        </LinkButton>
      </div>

      {parseError ? (
        <p className="text-sm text-destructive">{parseError}</p>
      ) : columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No columns found in this sheet.</p>
      ) : (
        <SupplierMappingForm
          storagePath={path}
          fileName={file}
          sheetIndex={activeSheet}
          columns={columns}
          headerRowIdx={0}
          sampleRows={sampleRows}
          guess={guess}
        />
      )}
    </div>
  );
}
