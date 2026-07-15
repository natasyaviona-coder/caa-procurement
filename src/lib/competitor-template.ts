// Parser for the CAA competitor pricing template (e.g. "BMW Kitchenware
// official.xlsx"): FX rate in row 1, header in row 3, then products. Reverse
// RMB is already computed in the sheet — we display it, not recompute it.
// Internal "_helper …" columns (per-variant label/price pairs) are ignored.

import { readSheet } from "@/lib/xlsx-view";
import { COMPETITOR_FIELDS, type CompetitorFieldKey } from "@/lib/competitor-fields";

// Re-exported for existing server-side importers.
export { COMPETITOR_FIELDS };
export type { CompetitorFieldKey };

// header text → our field key. Order matters: reverse columns before harga.
const COLUMN_PATTERNS: { key: "name" | "url" | CompetitorFieldKey; patterns: RegExp[] }[] = [
  { key: "name", patterns: [/nama\s*produk/i, /nama/i, /product\s*name/i, /^name$/i] },
  { key: "sold", patterns: [/terjual/i, /sold/i] },
  { key: "reverse_hpp", patterns: [/reverse.*hpp/i, /hpp\s*produk/i] },
  { key: "reverse_ongkir", patterns: [/reverse.*ongkir/i, /ongkir/i] },
  { key: "harga", patterns: [/harga/i, /price/i] },
  { key: "ukuran", patterns: [/ukuran/i, /size/i] },
  { key: "bahan", patterns: [/bahan/i, /material/i] },
  { key: "isi", patterns: [/^isi$/i, /isi\b/i, /content/i] },
  { key: "spec_lain", patterns: [/spesifikasi/i, /spec/i] },
  { key: "url", patterns: [/link/i, /url/i] },
];

const IMAGE_PATTERNS = [/foto/i, /picture/i, /image/i, /gambar/i];

export type CompetitorTemplateRow = {
  rowNum: number;
  name: string;
  productUrl: string | null;
  fields: Record<string, string>;
};

export type CompetitorTemplate = {
  detected: boolean;
  fxRate: number | null;
  headerRowNum: number;
  imageCol: number | null;
  rows: CompetitorTemplateRow[];
};

export function readCompetitorTemplate(
  buffer: Buffer,
  sheetIndex: number
): CompetitorTemplate {
  const grid = readSheet(buffer, sheetIndex, { maxRows: 3000 });

  // Header row: the one carrying "Nama Produk" (+ ideally the reverse-RMB col).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.rows.length, 6); i++) {
    const cells = grid.rows[i].cells;
    if (cells.some((c) => /nama\s*produk|product\s*name/i.test(c))) {
      headerIdx = i;
      break;
    }
  }
  const detected = headerIdx >= 0;
  if (!detected) {
    return { detected: false, fxRate: null, headerRowNum: 0, imageCol: null, rows: [] };
  }

  const header = grid.rows[headerIdx].cells;

  // FX rate from a "Kurs RMB" style cell in the rows above the header.
  let fxRate: number | null = null;
  for (let i = 0; i < headerIdx; i++) {
    const cells = grid.rows[i].cells;
    for (let c = 0; c < cells.length; c++) {
      if (/kurs\s*rmb|rmb.*rp|rp\s*per/i.test(cells[c])) {
        const n = Number((cells[c + 1] ?? cells[c].replace(/[^0-9.]/g, "")).toString().replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n) && n > 0) fxRate = n;
      }
    }
  }

  // Map columns (skip _helper columns entirely).
  const claimed = new Set<number>();
  const colOf = (key: string): number | null => {
    const entry = COLUMN_PATTERNS.find((p) => p.key === key);
    if (!entry) return null;
    for (let c = 0; c < header.length; c++) {
      if (claimed.has(c) || /^_helper/i.test(header[c])) continue;
      if (entry.patterns.some((p) => p.test(header[c]))) {
        claimed.add(c);
        return c;
      }
    }
    return null;
  };

  let imageCol: number | null = null;
  for (let c = 0; c < header.length; c++) {
    if (IMAGE_PATTERNS.some((p) => p.test(header[c]))) {
      imageCol = c;
      break;
    }
  }

  const nameCol = colOf("name");
  const urlCol = colOf("url");
  const fieldCols = new Map<CompetitorFieldKey, number | null>();
  for (const f of COMPETITOR_FIELDS) fieldCols.set(f.key, colOf(f.key));

  const rows: CompetitorTemplateRow[] = [];
  for (const r of grid.rows.slice(headerIdx + 1)) {
    const name = nameCol != null ? (r.cells[nameCol] ?? "").trim() : "";
    if (!name) continue; // skip blank/spacer rows
    const fields: Record<string, string> = {};
    for (const f of COMPETITOR_FIELDS) {
      const c = fieldCols.get(f.key);
      const v = c != null ? (r.cells[c] ?? "").trim() : "";
      if (v) fields[f.key] = v;
    }
    rows.push({
      rowNum: r.rowNum,
      name,
      productUrl: urlCol != null && r.cells[urlCol]?.trim() ? r.cells[urlCol].trim() : null,
      fields,
    });
  }

  return {
    detected: true,
    fxRate,
    headerRowNum: grid.rows[headerIdx].rowNum,
    imageCol,
    rows,
  };
}
