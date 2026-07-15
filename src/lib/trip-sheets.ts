// Sheet-name classification for Past Trips: sheet names are supplier names,
// except recap/invoice/admin-style sheets. Used to pre-fill the sheet picker —
// Nat can override per sheet before saving.

const OTHER_PATTERNS = [
  /rekap/i,
  /recap/i,
  /invoice/i,
  /\binv\b/i,
  /summary/i,
  /ringkasan/i,
  /total/i,
  /packing/i,
  /shipping/i,
  /ongkir/i,
  /payment/i,
  /pembayaran/i,
  /sheet\s*\d+$/i, // default unnamed sheets
  /tabellenblatt\d*$/i, // German Excel default sheet names (seen in real trip files)
];

export function classifySheetName(name: string): "supplier" | "other" {
  const trimmed = name.trim();
  return OTHER_PATTERNS.some((p) => p.test(trimmed)) ? "other" : "supplier";
}
