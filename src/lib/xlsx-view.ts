// Server-only .xlsx reader for the in-app file viewer.
//
// Ported from scripts/xlsx-parse.mjs, generalized to multiple sheets and
// returning plain string grids for display, plus per-sheet embedded-image
// lookup (floating drawing anchors — the reason normal spreadsheet libraries
// "lose" the product photos; see CLAUDE.md §6).
//
// Includes the two hardening fixes discovered testing the script against real
// files: cell regex written as distinct alternatives (no catastrophic
// backtracking on wide rows) and a worksheet-size guard so a giant non-price-
// list workbook errors fast instead of hanging the request.

import AdmZip from "adm-zip";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
}

function colToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n; // 1-indexed
}

export function indexToCol(index: number): string {
  let s = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const text = (si.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? [])
      .map((t) => decodeXml(t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "")))
      .join("");
    out.push(text);
  }
  return out;
}

const MAX_SHEET_XML_LENGTH = 5_000_000;

export type SheetInfo = { index: number; name: string };

export type SheetRow = { rowNum: number; cells: string[] };

export type SheetGrid = {
  name: string;
  /** Rows with their original 1-indexed worksheet row numbers. */
  rows: SheetRow[];
  totalRows: number;
  truncated: boolean;
};

type Workbook = {
  zip: AdmZip;
  sheets: { name: string; path: string }[];
  shared: string[];
  read: (name: string) => string | null;
};

function openWorkbook(buffer: Buffer): Workbook {
  const zip = new AdmZip(buffer);
  const read = (name: string): string | null => {
    const e = zip.getEntry(name);
    return e ? e.getData().toString("utf8") : null;
  };

  const workbookXml = read("xl/workbook.xml");
  if (!workbookXml) throw new Error("Not a valid .xlsx (no xl/workbook.xml)");
  const relsXml = read("xl/_rels/workbook.xml.rels") ?? "";

  // rId -> worksheet path
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(
    /<Relationship\b[^>]*\bId="(rId\d+)"[^>]*\bTarget="([^"]+)"/g
  )) {
    const target = m[2].replace(/^\//, "").replace(/^(?!xl\/)/, "xl/");
    rels.set(m[1], target);
  }

  const sheets: { name: string; path: string }[] = [];
  for (const m of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const nameM = m[1].match(/\bname="([^"]+)"/);
    const idM = m[1].match(/\br:id="(rId\d+)"/);
    if (nameM && idM) {
      const path = rels.get(idM[1]);
      if (path) sheets.push({ name: decodeXml(nameM[1]), path });
    }
  }
  if (sheets.length === 0) throw new Error("No sheets found in workbook");

  return { zip, sheets, shared: parseSharedStrings(read("xl/sharedStrings.xml")), read };
}

export function listSheets(buffer: Buffer): SheetInfo[] {
  const wb = openWorkbook(buffer);
  return wb.sheets.map((s, i) => ({ index: i, name: s.name }));
}

export function readSheet(
  buffer: Buffer,
  sheetIndex: number,
  { maxRows = 300 }: { maxRows?: number } = {}
): SheetGrid {
  const wb = openWorkbook(buffer);
  const sheet = wb.sheets[sheetIndex];
  if (!sheet) throw new Error(`Sheet ${sheetIndex} does not exist`);

  const xml = wb.read(sheet.path);
  if (!xml) throw new Error(`Missing ${sheet.path} in archive`);

  if (xml.length > MAX_SHEET_XML_LENGTH) {
    throw new Error(
      `This sheet is very large (${Math.round(xml.length / 1_000_000)}MB of data) — too big to preview here.`
    );
  }

  const rowsOut: { rowNum: number; cells: Map<number, string> }[] = [];
  let totalRows = 0;
  for (const rowM of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rNumM = rowM[1].match(/\br="(\d+)"/);
    if (!rNumM) continue;
    totalRows++;
    if (rowsOut.length >= maxRows) continue; // keep counting, stop collecting

    const cells = new Map<number, string>();
    for (const cM of rowM[2].matchAll(/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cM[1] ?? cM[2] ?? "";
      const inner = cM[3] ?? "";
      const colM = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!colM) continue;
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      let value: string;
      if (vM) {
        const raw = vM[1];
        if (/\bt="s"/.test(attrs)) {
          value = wb.shared[Number(raw)] ?? "";
        } else {
          value = /\bt="str"/.test(attrs) ? decodeXml(raw) : raw;
        }
      } else {
        // Inline strings (t="inlineStr") carry text in <is><t>…</t></is>
        // instead of <v> — used by our own xlsx-write output among others.
        const isM = inner.match(/<is>([\s\S]*?)<\/is>/);
        if (!isM) continue;
        value = (isM[1].match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? [])
          .map((t) => decodeXml(t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "")))
          .join("");
      }
      if (value !== "") cells.set(colToIndex(colM[1]), value);
    }
    if (cells.size > 0) rowsOut.push({ rowNum: Number(rNumM[1]), cells });
  }

  const maxCols = Math.min(
    Math.max(1, ...rowsOut.map((r) => Math.max(...r.cells.keys()))),
    40 // cap columns for display sanity
  );

  const rows: SheetRow[] = rowsOut.map((r) => {
    const cells: string[] = [];
    for (let c = 1; c <= maxCols; c++) cells.push(r.cells.get(c) ?? "");
    return { rowNum: r.rowNum, cells };
  });

  return { name: sheet.name, rows, totalRows, truncated: totalRows > maxRows };
}

// ---------------------------------------------------------------------------
// Embedded images (per sheet)
// ---------------------------------------------------------------------------

// Resolve the drawing XML + its rels for a given sheet via the worksheet's
// own rels file (each sheet can have its own drawingN.xml).
function resolveDrawing(
  wb: Workbook,
  sheetIndex: number
): { drawingXml: string; drawingRels: string } | null {
  const sheet = wb.sheets[sheetIndex];
  if (!sheet) return null;
  const base = sheet.path.split("/").pop()!;
  const relsXml = wb.read(`xl/worksheets/_rels/${base}.rels`);
  if (!relsXml) return null;

  let drawingTarget: string | null = null;
  for (const m of relsXml.matchAll(
    /<Relationship\b[^>]*\bType="[^"]*\/drawing"[^>]*\bTarget="([^"]+)"/g
  )) {
    drawingTarget = m[1];
    break;
  }
  // Attribute order can vary — retry with Target before Type.
  if (!drawingTarget) {
    for (const m of relsXml.matchAll(
      /<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bType="[^"]*\/drawing"/g
    )) {
      drawingTarget = m[1];
      break;
    }
  }
  if (!drawingTarget) return null;

  const drawingPath = drawingTarget.replace(/^\.\.\//, "xl/");
  const drawingXml = wb.read(drawingPath);
  if (!drawingXml) return null;
  const drawingBase = drawingPath.split("/").pop()!;
  const drawingRels = wb.read(`xl/drawings/_rels/${drawingBase}.rels`) ?? "";
  return { drawingXml, drawingRels };
}

// Map worksheetRow (1-indexed) -> media entry path, for images anchored on
// that row (first image per row wins; any column).
function imageRowMap(wb: Workbook, sheetIndex: number): Map<number, string> {
  const images = new Map<number, string>();
  const d = resolveDrawing(wb, sheetIndex);
  if (!d) return images;

  const rels = new Map<string, string>();
  for (const m of d.drawingRels.matchAll(
    /<Relationship\b[^>]*\bId="(rId\d+)"[^>]*\bTarget="([^"]+)"/g
  )) {
    rels.set(m[1], m[2].replace(/^\.\.\//, "xl/"));
  }

  for (const anchorM of d.drawingXml.matchAll(
    /<xdr:(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:\1>/g
  )) {
    const body = anchorM[0];
    const from = body.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/);
    if (!from) continue;
    const row = from[1].match(/<xdr:row>(\d+)<\/xdr:row>/);
    const embed = body.match(/r:embed="(rId\d+)"/);
    if (!row || !embed) continue;
    const worksheetRow = Number(row[1]) + 1; // 0-indexed anchor -> 1-indexed row
    const media = rels.get(embed[1]);
    if (media && !images.has(worksheetRow)) images.set(worksheetRow, media);
  }
  return images;
}

/** Which worksheet rows of this sheet have an embedded image. */
export function sheetImageRows(buffer: Buffer, sheetIndex: number): Set<number> {
  const wb = openWorkbook(buffer);
  return new Set(imageRowMap(wb, sheetIndex).keys());
}

const MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** The embedded image anchored on a given worksheet row, or null. */
export function sheetImage(
  buffer: Buffer,
  sheetIndex: number,
  rowNum: number
): { data: Buffer; contentType: string } | null {
  const wb = openWorkbook(buffer);
  const media = imageRowMap(wb, sheetIndex).get(rowNum);
  if (!media) return null;
  const entry = wb.zip.getEntry(media);
  if (!entry) return null;
  const ext = media.split(".").pop()!.toLowerCase();
  return { data: entry.getData(), contentType: MIME[ext] ?? "image/jpeg" };
}
