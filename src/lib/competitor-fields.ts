// Client-safe: the fixed display columns for the competitor template. Kept in
// its own module (no server-only imports like adm-zip) so client components can
// import it without pulling Node's `fs` into the browser bundle.

export const COMPETITOR_FIELDS = [
  { key: "sold", label: "Terjual Berapa" },
  { key: "harga", label: "Harga" },
  { key: "reverse_hpp", label: "Reverse RMB - HPP Produk (¥)", highlight: true },
  { key: "reverse_ongkir", label: "Reverse RMB - Ongkir" },
  { key: "ukuran", label: "Ukuran" },
  { key: "bahan", label: "Bahan" },
  { key: "isi", label: "Isi" },
  { key: "spec_lain", label: "Spesifikasi Lain" },
] as const;

export type CompetitorFieldKey = (typeof COMPETITOR_FIELDS)[number]["key"];
