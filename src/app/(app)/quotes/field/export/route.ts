import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeFieldQuote } from "@/lib/field-calc";
import { buildXlsx, type CellValue } from "@/lib/xlsx-write";

// Exports one supplier's field quotations as .xlsx. Values are recomputed
// with the same lib the capture form uses, so the export always matches
// what was shown on screen.
export async function GET(request: NextRequest) {
  const supplierId = request.nextUrl.searchParams.get("supplier");
  if (!supplierId) {
    return NextResponse.json({ error: "supplier param required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [supplierRes, quotesRes] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("id", supplierId).single(),
    supabase
      .from("field_quotes")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: true }),
  ]);
  if (supplierRes.error || !supplierRes.data) {
    return NextResponse.json({ error: "supplier not found" }, { status: 404 });
  }

  const header: CellValue[] = [
    "Date",
    "Product Name",
    "Photo URL",
    "Price (RMB)",
    "Qty/Carton",
    "Carton P (cm)",
    "Carton L (cm)",
    "Carton T (cm)",
    "CBM",
    "Product Size (P×L×T cm)",
    "FX Rate",
    "Freight IDR/CBM",
    "Admin %",
    "Order Fee (IDR)",
    "Packaging Fee (IDR)",
    "HPP Produk (IDR)",
    "Ongkir (IDR/unit)",
    "HPP Landed (IDR)",
    "Est. Sell Price (IDR)",
    "Profit Margin %",
    "Margin after Admin %",
    "Notes",
  ];

  const rows: CellValue[][] = [header];
  for (const q of quotesRes.data ?? []) {
    const calc = computeFieldQuote({
      priceRmb: q.price_rmb != null ? Number(q.price_rmb) : null,
      qtyPerCarton: q.qty_per_carton,
      cbm: q.cbm != null ? Number(q.cbm) : null,
      cartonP: q.carton_p_cm != null ? Number(q.carton_p_cm) : null,
      cartonL: q.carton_l_cm != null ? Number(q.carton_l_cm) : null,
      cartonT: q.carton_t_cm != null ? Number(q.carton_t_cm) : null,
      estSellPrice: q.est_sell_price != null ? Number(q.est_sell_price) : null,
      fxRate: Number(q.fx_rate),
      freightPerCbm: Number(q.freight_per_cbm),
      adminPct: Number(q.admin_pct),
      orderFee: Number(q.order_fee),
      packagingFee: Number(q.packaging_fee),
    });
    const size =
      q.size_p_cm || q.size_l_cm || q.size_t_cm
        ? [q.size_p_cm, q.size_l_cm, q.size_t_cm]
            .map((v) => (v != null ? Number(v) : "?"))
            .join("×")
        : null;

    rows.push([
      new Date(q.created_at).toISOString().slice(0, 10),
      q.product_name,
      q.photo_url,
      q.price_rmb != null ? Number(q.price_rmb) : null,
      q.qty_per_carton,
      q.carton_p_cm != null ? Number(q.carton_p_cm) : null,
      q.carton_l_cm != null ? Number(q.carton_l_cm) : null,
      q.carton_t_cm != null ? Number(q.carton_t_cm) : null,
      calc.cbmEffective != null ? Number(calc.cbmEffective.toFixed(6)) : null,
      size,
      Number(q.fx_rate),
      Number(q.freight_per_cbm),
      Number(q.admin_pct),
      Number(q.order_fee),
      Number(q.packaging_fee),
      calc.hppProduk != null ? Math.round(calc.hppProduk) : null,
      calc.ongkirPerUnit != null ? Math.round(calc.ongkirPerUnit) : null,
      calc.hppLanded != null ? Math.round(calc.hppLanded) : null,
      q.est_sell_price != null ? Number(q.est_sell_price) : null,
      calc.marginSimple != null ? Number((calc.marginSimple * 100).toFixed(1)) : null,
      calc.marginAfterAdmin != null
        ? Number((calc.marginAfterAdmin * 100).toFixed(1))
        : null,
      q.notes,
    ]);
  }

  const safeName = supplierRes.data.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const xlsx = buildXlsx(rows, "Quotes Field");

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="QuotesField_${safeName}_${date}.xlsx"`,
    },
  });
}
