// Standardized reader for a trip's SUPPLIER sheet.
//
// Fixed format (per Nat): header is always on worksheet row 2, row 1 is a
// totals row (total CTN / total price / total CBM). Columns:
//   PICTURE · MARKING CODE · NAME · PRICE · QTY · CTN · TOTAL QTY · TOTAL PRICE
//
// Column positions are detected by header text (row 2) so slightly different
// spellings still map. Totals are summed from the data columns, plus total CBM
// pulled from the row-1 totals area (there's no CBM data column to sum).

import { readSheet } from "@/lib/xlsx-view";
import { parseIdr } from "@/lib/reverse-rmb";

// CBM is a small decimal — the dot is a decimal point, not an IDR thousands
// separator, so it needs its own parser (parseIdr would turn 4.85 into 485).
function parseDecimal(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let c = String(raw).replace(/[^0-9.,]/g, "");
  if (!c) return null;
  if (c.includes(",") && !c.includes(".")) c = c.replace(",", ".");
  else c = c.replace(/,/g, "");
  const n = Number(c);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const TRIP_COLUMNS = [
  { key: "marking", label: "Marking Code" },
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "qty", label: "Qty" },
  { key: "ctn", label: "CTN" },
  { key: "total_qty", label: "Total Qty" },
  { key: "total_price", label: "Total Price" },
] as const;

export type TripColKey = (typeof TRIP_COLUMNS)[number]["key"];

// "total ..." variants are matched first so they claim their columns before the
// bare price/qty patterns try.
const MATCH_ORDER: { key: TripColKey; patterns: RegExp[] }[] = [
  { key: "total_qty", patterns: [/total\s*qty/i, /total\s*quantity/i, /total\s*jml/i] },
  { key: "total_price", patterns: [/total\s*price/i, /total\s*harga/i, /grand\s*total/i, /amount/i] },
  { key: "marking", patterns: [/marking/i, /kode/i, /\bcode\b/i, /item\s*no/i, /model/i, /货号/] },
  { key: "name", patterns: [/name/i, /nama/i, /品名/, /description/i, /deskripsi/i] },
  { key: "price", patterns: [/price/i, /harga/i, /单价/, /unit/i] },
  { key: "qty", patterns: [/qty/i, /quantity/i, /jumlah/i, /jml/i, /pcs/i] },
  { key: "ctn", patterns: [/ctn/i, /carton/i, /karton/i, /box/i, /箱/] },
];

const IMAGE_PATTERNS = [/picture/i, /image/i, /photo/i, /gambar/i, /foto/i];

function detectHeaderRow(rows: { cells: string[] }[]): number {
  let best = -1;
  let bestScore = 0;
  // Header is on row 2, but scan the first few non-empty rows and pick the
  // best match so a stray blank/merged row can't throw off the mapping.
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].cells.map((c) => c.toLowerCase());
    let score = 0;
    for (const { patterns } of MATCH_ORDER) {
      if (cells.some((c) => patterns.some((p) => p.test(c)))) score++;
    }
    if (IMAGE_PATTERNS.some((p) => cells.some((c) => p.test(c)))) score++;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // Fall back to the second non-empty row (worksheet row 2) when detection is weak.
  return bestScore >= 2 ? best : Math.min(1, rows.length - 1);
}

export type TripSheet = {
  columns: { key: TripColKey; label: string; col: number | null }[];
  hasImageColumn: boolean;
  rows: { rowNum: number; values: Record<TripColKey, string> }[];
  totals: {
    ctn: number | null;
    totalQty: number | null;
    totalPrice: number | null;
    cbm: number | null;
  };
  headerRowNum: number;
};

export function readTripSupplierSheet(buffer: Buffer, sheetIndex: number): TripSheet {
  const grid = readSheet(buffer, sheetIndex, { maxRows: 3000 });
  const headerIdx = detectHeaderRow(grid.rows);
  const header = grid.rows[headerIdx]?.cells ?? [];
  const claimed = new Set<number>();

  const mapKey = (key: TripColKey): number | null => {
    const entry = MATCH_ORDER.find((m) => m.key === key)!;
    for (let c = 0; c < header.length; c++) {
      if (claimed.has(c)) continue;
      if (entry.patterns.some((p) => p.test(header[c]))) {
        claimed.add(c);
        return c;
      }
    }
    return null;
  };

  const cols = TRIP_COLUMNS.map((c) => ({ ...c, col: mapKey(c.key) }));
  const colByKey = new Map(cols.map((c) => [c.key, c.col]));

  const dataRows = grid.rows.slice(headerIdx + 1).map((r) => {
    const values = {} as Record<TripColKey, string>;
    for (const c of TRIP_COLUMNS) {
      const idx = colByKey.get(c.key);
      values[c.key] = idx != null ? (r.cells[idx] ?? "") : "";
    }
    return { rowNum: r.rowNum, values };
  });

  const sumCol = (key: TripColKey): number | null => {
    const idx = colByKey.get(key);
    if (idx == null) return null;
    let sum = 0;
    let any = false;
    for (const r of dataRows) {
      const n = parseIdr(r.values[key]);
      if (n != null) {
        sum += n;
        any = true;
      }
    }
    return any ? sum : null;
  };

  // Total CBM: no data column to sum — read it from the row-1 totals area by
  // finding a cell that mentions CBM and taking a number from it or its neighbour.
  let cbm: number | null = null;
  const totalsRows = grid.rows.slice(0, headerIdx); // rows above the header (row 1)
  outer: for (const r of totalsRows) {
    for (let c = 0; c < r.cells.length; c++) {
      if (/cbm/i.test(r.cells[c])) {
        const inline = parseDecimal(r.cells[c].replace(/cbm/i, ""));
        if (inline != null) {
          cbm = inline;
          break outer;
        }
        const next = parseDecimal(r.cells[c + 1] ?? "");
        if (next != null) {
          cbm = next;
          break outer;
        }
      }
    }
  }

  return {
    columns: cols,
    hasImageColumn: header.some((h) => IMAGE_PATTERNS.some((p) => p.test(h))),
    rows: dataRows,
    totals: {
      ctn: sumCol("ctn"),
      totalQty: sumCol("total_qty") ?? sumCol("qty"),
      totalPrice: sumCol("total_price"),
      cbm,
    },
    headerRowNum: grid.rows[headerIdx]?.rowNum ?? 2,
  };
}
