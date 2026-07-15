import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite, isAdmin } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import { SheetPicker } from "./sheet-picker";
import { TripActions } from "./trip-actions";
import {
  listSheets,
  readSheet,
  sheetImageRows,
  type SheetGrid,
} from "@/lib/xlsx-view";
import { classifySheetName } from "@/lib/trip-sheets";
import {
  readTripSupplierSheet,
  TRIP_COLUMNS,
  type TripSheet,
} from "@/lib/trip-format";
import { formatIDR, formatNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GRID = "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sheet?: string; edit?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { sheet, edit } = await searchParams;
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !trip) notFound();

  const { data: blob, error: dlErr } = await supabase.storage
    .from("price-lists")
    .download(trip.storage_path);

  let allSheets: { index: number; name: string }[] = [];
  let viewError: string | null = dlErr?.message ?? null;
  let buffer: Buffer | null = null;
  if (blob) {
    try {
      buffer = Buffer.from(await blob.arrayBuffer());
      allSheets = listSheets(buffer);
    } catch (err) {
      viewError = err instanceof Error ? err.message : "Could not parse this file";
    }
  }

  const selected = (trip.selected_sheets ?? []) as {
    index: number;
    name: string;
    kind: "supplier" | "other";
  }[];
  const editing = edit === "1" || selected.length === 0;
  const writable = canWrite(profile.role);

  // Order sheets: rekap/invoice first, then suppliers alphabetically.
  const ordered = [...selected].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "other" ? -1 : 1
  );
  const suppliers = ordered.filter((s) => s.kind === "supplier");
  const requestedIdx = Number(sheet ?? NaN);
  const activeSel =
    ordered.find((s) => s.index === requestedIdx) ?? ordered[0] ?? null;

  // Supplier sheets render in Nat's fixed format (header row 2, totals from
  // row 1); other sheets (REKAP/invoice) show as a raw table.
  let grid: SheetGrid | null = null;
  let tripSheet: TripSheet | null = null;
  let imageRows = new Set<number>();
  if (!editing && buffer && activeSel) {
    try {
      imageRows = sheetImageRows(buffer, activeSel.index);
      if (activeSel.kind === "supplier") {
        tripSheet = readTripSupplierSheet(buffer, activeSel.index);
      } else {
        grid = readSheet(buffer, activeSel.index);
      }
    } catch (err) {
      viewError = err instanceof Error ? err.message : "Could not read this sheet";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{trip.name}</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded {new Date(trip.created_at).toLocaleDateString("id-ID")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {writable && !editing ? (
            <TripActions
              tripId={trip.id}
              tripName={trip.name}
              canDelete={isAdmin(profile.role)}
              hasSource={Boolean(trip.source_url)}
            />
          ) : null}
          <LinkButton href="/trips" variant="outline">
            Back to trips
          </LinkButton>
        </div>
      </div>

      {viewError ? <p className="text-sm text-destructive">{viewError}</p> : null}

      {editing ? (
        writable ? (
          <SheetPicker
            tripId={trip.id}
            allSheets={allSheets.map((s) => ({
              index: s.index,
              name: s.name,
              suggestedKind: classifySheetName(s.name),
            }))}
            initial={selected}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Sheets haven&apos;t been picked for this trip yet.
          </p>
        )
      ) : (
        <>
          {/* Supplier overview */}
          <section className="rounded-md border bg-muted/20 p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Suppliers in this trip ({suppliers.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {suppliers.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No supplier sheets selected.
                </span>
              ) : (
                suppliers.map((s) => (
                  <Link key={s.index} href={`/trips/${trip.id}?sheet=${s.index}`}>
                    <Badge
                      className={cn(
                        "cursor-pointer",
                        activeSel?.index === s.index
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                      )}
                    >
                      {s.name}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Sheet tabs (rekap/invoice first, then suppliers) */}
          <div className="flex flex-wrap gap-1 border-b pb-2">
            {ordered.map((s) => (
              <Link
                key={s.index}
                href={`/trips/${trip.id}?sheet=${s.index}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  activeSel?.index === s.index && "bg-muted font-medium text-foreground"
                )}
              >
                {s.kind === "other" ? `📋 ${s.name}` : s.name}
              </Link>
            ))}
          </div>

          {tripSheet && activeSel ? (
            <TripSupplierView
              tripId={trip.id}
              sheetIndex={activeSel.index}
              sheet={tripSheet}
              imageRows={imageRows}
            />
          ) : null}

          {grid ? (
            <div className="overflow-x-auto rounded-md border">
              <Table className={GRID}>
                {grid.rows.length > 0 ? (
                  <TableHeader>
                    <TableRow>
                      {imageRows.size > 0 ? <TableHead>Photo</TableHead> : null}
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
                        colSpan={Math.max(1, (grid.rows[0]?.cells.length ?? 1) + 1)}
                        className="text-center text-muted-foreground"
                      >
                        No data rows in this sheet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    grid.rows.slice(1).map((row) => (
                      <TableRow key={row.rowNum}>
                        {imageRows.size > 0 ? (
                          <TableCell className="w-16">
                            {imageRows.has(row.rowNum) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/trips/${trip.id}/image/${row.rowNum}?sheet=${activeSel!.index}`}
                                alt=""
                                loading="lazy"
                                className="h-14 w-14 rounded object-contain"
                              />
                            ) : null}
                          </TableCell>
                        ) : null}
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
          ) : null}
        </>
      )}
    </div>
  );
}

const IDR_KEYS = new Set(["price", "total_price"]);

function TripSupplierView({
  tripId,
  sheetIndex,
  sheet,
  imageRows,
}: {
  tripId: string;
  sheetIndex: number;
  sheet: TripSheet;
  imageRows: Set<number>;
}) {
  return (
    <div className="space-y-3">
      {/* Row-1 totals */}
      <section className="flex flex-wrap gap-x-8 gap-y-2 rounded-md border bg-muted/20 p-3">
        <Total label="Total CTN" value={sheet.totals.ctn != null ? formatNum(sheet.totals.ctn, 0) : "—"} />
        <Total label="Total Qty" value={sheet.totals.totalQty != null ? formatNum(sheet.totals.totalQty, 0) : "—"} />
        <Total
          label="Total Price"
          value={sheet.totals.totalPrice != null ? formatIDR(sheet.totals.totalPrice) : "—"}
        />
        <Total
          label="Total CBM"
          value={sheet.totals.cbm != null ? formatNum(sheet.totals.cbm, 4) : "—"}
        />
      </section>

      <div className="overflow-x-auto rounded-md border">
        <Table className={GRID}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Picture</TableHead>
              {TRIP_COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap font-semibold",
                    IDR_KEYS.has(c.key) && "text-right"
                  )}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TRIP_COLUMNS.length + 1}
                  className="text-center text-muted-foreground"
                >
                  No product rows found.
                </TableCell>
              </TableRow>
            ) : (
              sheet.rows.map((r) => (
                <TableRow key={r.rowNum}>
                  <TableCell className="w-28">
                    {imageRows.has(r.rowNum) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/trips/${tripId}/image/${r.rowNum}?sheet=${sheetIndex}`}
                        alt=""
                        loading="lazy"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded bg-muted" />
                    )}
                  </TableCell>
                  {TRIP_COLUMNS.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "text-xs",
                        c.key === "name" ? "max-w-64" : "whitespace-nowrap",
                        IDR_KEYS.has(c.key) && "text-right tabular-nums"
                      )}
                    >
                      {r.values[c.key] || "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
