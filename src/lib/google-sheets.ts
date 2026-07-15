// Server-only: pull a link-shared Google Sheet as an .xlsx workbook.
//
// A Google Sheet shared "Anyone with the link → Viewer" can be exported without
// any API key or OAuth via the /export endpoint. A private sheet redirects to a
// Google login page and returns HTML instead of the file — we detect that by
// checking the zip magic bytes and surface a clear error.

const MAX_BYTES = 50 * 1024 * 1024;

/** Extract the spreadsheet ID from any Google Sheets URL, or null. */
export function parseSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export type FetchedSheet = {
  buffer: Buffer;
  /** Sheet title from Content-Disposition, if Google provided one. */
  suggestedName: string | null;
};

function nameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  // filename*=UTF-8''My%20Trip.xlsx  (preferred, handles unicode)
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]).replace(/\.xlsx$/i, "").trim() || null;
    } catch {
      /* fall through */
    }
  }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1].replace(/\.xlsx$/i, "").trim() || null;
  return null;
}

/**
 * Download a Google Sheet as xlsx bytes. Throws with a user-facing message
 * on any failure (bad link, not shared, wrong content).
 */
export async function fetchGoogleSheetXlsx(url: string): Promise<FetchedSheet> {
  const id = parseSheetId(url);
  if (!id) {
    throw new Error(
      "That doesn't look like a Google Sheets link (expected docs.google.com/spreadsheets/d/…)."
    );
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  let res: Response;
  try {
    res = await fetch(exportUrl, { redirect: "follow" });
  } catch {
    throw new Error("Could not reach Google Sheets. Check your connection and try again.");
  }

  if (!res.ok) {
    throw new Error(
      `Google returned ${res.status}. Make sure the sheet is shared as "Anyone with the link → Viewer".`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_BYTES) {
    throw new Error("This sheet is larger than 50MB.");
  }
  const buffer = Buffer.from(arrayBuf);

  // .xlsx is a zip → first bytes are "PK". An HTML login/redirect page starts
  // with "<" and has an text/html content-type.
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip || contentType.includes("text/html")) {
    throw new Error(
      "This sheet isn't publicly viewable. In Google Sheets: Share → General access → \"Anyone with the link\" → Viewer, then paste the link again."
    );
  }

  return {
    buffer,
    suggestedName: nameFromContentDisposition(res.headers.get("content-disposition")),
  };
}
