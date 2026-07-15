// Minimal, dependency-light .xlsx reader tailored to supplier price lists.
//
// A .xlsx is a zip. We do NOT use a full spreadsheet library because the whole
// point is the embedded product photos, which live as floating drawing objects
// (xdr:twoCellAnchor) anchored to a (row, col) position — SheetJS and friends
// drop these. So we read the raw parts ourselves:
//   xl/worksheets/sheetN.xml          → cell values (via shared strings)
//   xl/sharedStrings.xml              → the actual text for t="s" cells
//   xl/drawings/drawingN.xml          → image anchors (which row each image sits on)
//   xl/drawings/_rels/drawingN.xml.rels → relationship id → media file path
//   xl/media/*                        → the image bytes
//
// See CLAUDE.md section 6. Anchor row/col are 0-indexed, so anchor row=1 is
// worksheet row 2.

import AdmZip from "adm-zip";

const XML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(s) {
  if (s == null) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);
}

// "B" -> 2 (1-indexed, A=1). Matches how we address columns below.
function colToIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    // Concatenate all <t> runs inside the <si> (rich text has several).
    const text = (si.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? [])
      .map((t) => decodeXml(t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "")))
      .join("");
    out.push(text);
  }
  return out;
}

// Returns a Map<rowNumber(1-indexed), Map<colLetter, value>>
function parseSheet(xml, shared) {
  const rows = new Map();
  for (const rowM of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = rowM[1];
    const rNumM = rowAttrs.match(/\br="(\d+)"/);
    if (!rNumM) continue;
    const rowNum = Number(rNumM[1]);
    const cells = new Map();
    const body = rowM[2];
    // Two cell shapes, matched as distinct alternatives (not a shared
    // greedy/lazy prefix) to avoid catastrophic backtracking on wide,
    // attribute-heavy rows (seen on financial workbooks with many columns —
    // the simple product-list shape this was first tested against never hit
    // this): self-closing (<c .../>) has no value; full (<c ...>...</c>).
    for (const cM of body.matchAll(/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cM[1] ?? cM[2] ?? "";
      const inner = cM[3] ?? "";
      const colM = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!colM) continue;
      const colLetter = colM[1];
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (!vM) continue;
      const raw = vM[1];
      let value;
      if (/\bt="s"/.test(attrs)) {
        value = shared[Number(raw)] ?? "";
      } else {
        // numeric, or t="str" formula string result
        value = /\bt="str"/.test(attrs) ? decodeXml(raw) : raw;
      }
      if (value !== "" && value != null) cells.set(colLetter, value);
    }
    rows.set(rowNum, cells);
  }
  return rows;
}

// Returns Map<worksheetRow(1-indexed), mediaEntryName> for images anchored in
// the given column (default col 0 = "A", the product-image column).
function parseDrawingImages(drawingXml, relsXml, imageColIndex = 0) {
  const images = new Map();
  if (!drawingXml || !relsXml) return images;

  // rId -> media path (e.g. "../media/image1.jpeg" -> "xl/media/image1.jpeg")
  const rels = new Map();
  for (const m of relsXml.matchAll(
    /<Relationship\b[^>]*\bId="(rId\d+)"[^>]*\bTarget="([^"]+)"/g
  )) {
    const target = m[2].replace(/^\.\.\//, "xl/");
    rels.set(m[1], target);
  }

  for (const anchorM of drawingXml.matchAll(
    /<xdr:(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:\1>/g
  )) {
    const body = anchorM[0];
    const from = body.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/);
    if (!from) continue;
    const col = from[1].match(/<xdr:col>(\d+)<\/xdr:col>/);
    const row = from[1].match(/<xdr:row>(\d+)<\/xdr:row>/);
    const embed = body.match(/r:embed="(rId\d+)"/);
    if (!col || !row || !embed) continue;
    if (Number(col[1]) !== imageColIndex) continue;

    const worksheetRow = Number(row[1]) + 1; // 0-indexed anchor -> 1-indexed row
    const media = rels.get(embed[1]);
    if (media && !images.has(worksheetRow)) {
      images.set(worksheetRow, media);
    }
  }
  return images;
}

/**
 * Read a supplier price-list .xlsx.
 * @returns {{ rows: Array<{rowNum:number, cells:Map, image:{name:string,buffer:Buffer,ext:string}|null}>, sheetName:string }}
 */
export function readPriceList(filePath, { imageColIndex = 0 } = {}) {
  const zip = new AdmZip(filePath);
  const read = (name) => {
    const e = zip.getEntry(name);
    return e ? e.getData().toString("utf8") : null;
  };

  const shared = parseSharedStrings(read("xl/sharedStrings.xml"));

  // First worksheet. Workbook lists sheets in order; sheet1.xml is the usual
  // first-sheet path for LibreOffice/Excel exports.
  const workbook = read("xl/workbook.xml") ?? "";
  const sheetNameM = workbook.match(/<sheet\b[^>]*\bname="([^"]+)"/);
  const sheetName = sheetNameM ? decodeXml(sheetNameM[1]) : "Sheet1";

  const sheetXml =
    read("xl/worksheets/sheet1.xml") ??
    read("xl/worksheets/Sheet1.xml");
  if (!sheetXml) throw new Error("Could not find xl/worksheets/sheet1.xml");

  // Real supplier price lists we've seen top out around 600KB of worksheet
  // XML (a few hundred rows, a couple dozen columns). Financial/inventory
  // workbooks that aren't price lists can decompress to tens of MB and make
  // the regex-based parse below take unreasonably long — fail fast instead
  // of hanging so a --dir batch can report and move on.
  const MAX_SHEET_XML_LENGTH = 5_000_000;
  if (sheetXml.length > MAX_SHEET_XML_LENGTH) {
    throw new Error(
      `Worksheet XML is ${Math.round(sheetXml.length / 1_000_000)}MB — too large to be a supplier price list (expected well under 5MB). Skipping.`
    );
  }

  const cellsByRow = parseSheet(sheetXml, shared);

  // Drawing for the first sheet.
  const drawingXml = read("xl/drawings/drawing1.xml");
  const relsXml = read("xl/drawings/_rels/drawing1.xml.rels");
  const imageRowMap = parseDrawingImages(drawingXml, relsXml, imageColIndex);

  const mediaBuffer = (name) => {
    const e = zip.getEntry(name);
    return e ? e.getData() : null;
  };

  const rows = [];
  for (const [rowNum, cells] of [...cellsByRow.entries()].sort((a, b) => a[0] - b[0])) {
    const mediaName = imageRowMap.get(rowNum) ?? null;
    let image = null;
    if (mediaName) {
      const buffer = mediaBuffer(mediaName);
      if (buffer) {
        const ext = mediaName.split(".").pop().toLowerCase();
        image = { name: mediaName, buffer, ext };
      }
    }
    rows.push({ rowNum, cells, image });
  }

  return { rows, sheetName };
}

export { colToIndex };
