// Header auto-mapping: recognizes the column-header variants that appear in
// real supplier price lists (Chinese, English, Indonesian) and maps them onto
// Nat's standard format, so files don't need to be manually reformatted
// before upload. Unrecognized files simply fall back to the raw sheet view.
//
// To support a new supplier layout, add its header text to ALIASES below.

import type { SheetRow } from "@/lib/xlsx-view";

export const STANDARD_COLUMNS = [
  { key: "image", label: "Product Image" },
  { key: "model", label: "Model No." },
  { key: "name", label: "Product Name" },
  { key: "price", label: "Unit Price (RMB)" },
  { key: "qty_carton", label: "Qty/Carton" },
  { key: "size", label: "Product Size" },
  { key: "weight", label: "Weight (g)" },
  { key: "carton_size", label: "Carton Size (cm)" },
  { key: "hpp_produk", label: "HPP Produk (IDR)" },
  { key: "cbm", label: "CBM" },
  { key: "ongkir", label: "Ongkir (IDR/unit)" },
  { key: "hpp_landed", label: "HPP Landed (IDR)" },
] as const;

export type StandardKey = (typeof STANDARD_COLUMNS)[number]["key"];

// Alias lists are matched in order — put more specific keys first in
// MATCH_ORDER so e.g. "hpp landed" claims its column before "hpp produk"
// tries, and "unit price" wins over a bare "price".
const ALIASES: Record<StandardKey, string[]> = {
  image: ["产品图片", "product image", "图片", "image", "photo", "foto"],
  model: ["货号", "item no", "model no", "model", "marking code", "kode", "sku"],
  name: ["品名", "product name", "nama produk", "description", "name", "nama"],
  price: ["单价", "unit price", "harga (rmb)", "rmb", "price", "harga"],
  qty_carton: ["装箱量", "qty per carton", "qty/carton", "pcs/ctn", "qty / carton", "qty"],
  size: ["产品尺寸", "尺寸", "product size", "size (cm)", "ukuran", "size"],
  weight: ["重量", "weight"],
  carton_size: ["外箱", "carton size", "ctn size"],
  hpp_produk: ["hpp produk"],
  cbm: ["cbm", "体积"],
  ongkir: ["ongkir"],
  hpp_landed: ["hpp landed", "landed"],
};

const MATCH_ORDER: StandardKey[] = [
  "hpp_landed",
  "hpp_produk",
  "ongkir",
  "cbm",
  "carton_size",
  "qty_carton",
  "image",
  "model",
  "name",
  "price",
  "size",
  "weight",
];

function normalize(header: string): string {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

export type ColumnMapping = {
  headerRowIdx: number; // index into grid.rows
  /** standard key -> column index in SheetRow.cells */
  columns: Partial<Record<StandardKey, number>>;
  /** headers present in the file that didn't map to any standard column */
  unmappedHeaders: string[];
};

function mapRow(cells: string[]): {
  columns: Partial<Record<StandardKey, number>>;
  unmapped: string[];
} {
  const columns: Partial<Record<StandardKey, number>> = {};
  const claimed = new Set<number>();

  for (const key of MATCH_ORDER) {
    for (const alias of ALIASES[key]) {
      let found = -1;
      // Exact match beats substring so a bare "Price" column doesn't steal
      // from "Unit Price" elsewhere in the row.
      for (let c = 0; c < cells.length; c++) {
        if (claimed.has(c)) continue;
        if (normalize(cells[c]) === alias) {
          found = c;
          break;
        }
      }
      if (found === -1) {
        for (let c = 0; c < cells.length; c++) {
          if (claimed.has(c)) continue;
          if (cells[c] && normalize(cells[c]).includes(alias)) {
            found = c;
            break;
          }
        }
      }
      if (found !== -1) {
        columns[key] = found;
        claimed.add(found);
        break;
      }
    }
  }

  const unmapped = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c.trim() !== "" && !claimed.has(i))
    .map(({ c }) => c.replace(/\s+/g, " ").trim());

  return { columns, unmapped };
}

export type AssumptionRow = { label: string; value: string };

/**
 * Pull the ASSUMPTIONS block (label/value pairs in a side column, e.g.
 * "RMB -> IDR rate | 2700") out of the sheet so the viewer can show it on
 * top. Looks for a header cell containing "assumption", then reads the
 * label column + the next non-empty column downward.
 */
export function extractAssumptions(rows: SheetRow[]): AssumptionRow[] {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const cells = rows[i].cells;
    for (let c = 0; c < cells.length; c++) {
      if (!/assumption|asumsi/i.test(cells[c] ?? "")) continue;
      const out: AssumptionRow[] = [];
      for (let j = i + 1; j < Math.min(rows.length, i + 15); j++) {
        const label = (rows[j].cells[c] ?? "").replace(/\s+/g, " ").trim();
        if (!label) continue;
        const value = (
          rows[j].cells[c + 1]?.trim() ||
          rows[j].cells[c + 2]?.trim() ||
          ""
        ).trim();
        out.push({ label, value });
      }
      if (out.length > 0) return out;
    }
  }
  return [];
}

/**
 * Scan the first few rows for the header row and map its columns to the
 * standard format. Returns null when the sheet doesn't look like a price
 * list (fewer than 3 recognized columns, or no model/price column) — the
 * caller should fall back to the raw view.
 */
export function detectMapping(rows: SheetRow[]): ColumnMapping | null {
  let best: ColumnMapping | null = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const { columns, unmapped } = mapRow(rows[i].cells);
    const score = Object.keys(columns).length;
    if (score > bestScore) {
      bestScore = score;
      best = { headerRowIdx: i, columns, unmappedHeaders: unmapped };
    }
  }

  if (!best || bestScore < 3) return null;
  if (best.columns.model == null && best.columns.price == null) return null;
  return best;
}
