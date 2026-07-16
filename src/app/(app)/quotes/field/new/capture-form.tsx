"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { computeFieldQuote, DEFAULT_ASSUMPTIONS } from "@/lib/field-calc";
import { saveFieldQuote } from "../actions";
import { cn } from "@/lib/utils";

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtIdr(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("id-ID");
}

export function CaptureForm({
  supplier,
}: {
  supplier: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ocrBusy, setOcrBusy] = useState(false);

  // photos
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [cardPhoto, setCardPhoto] = useState<File | null>(null);
  const productPreview = useMemo(
    () => (productPhoto ? URL.createObjectURL(productPhoto) : null),
    [productPhoto]
  );
  const cardPreview = useMemo(
    () => (cardPhoto ? URL.createObjectURL(cardPhoto) : null),
    [cardPhoto]
  );
  // data fields (strings so inputs stay controlled + empty-able)
  const [productName, setProductName] = useState("");
  const [priceRmb, setPriceRmb] = useState("");
  const [qtyPerCarton, setQtyPerCarton] = useState("");
  const [cbm, setCbm] = useState("");
  const [cartonP, setCartonP] = useState("");
  const [cartonL, setCartonL] = useState("");
  const [cartonT, setCartonT] = useState("");
  const [sizeP, setSizeP] = useState("");
  const [sizeL, setSizeL] = useState("");
  const [sizeT, setSizeT] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [notes, setNotes] = useState("");

  // assumptions (editable, FEI defaults)
  const [fxRate, setFxRate] = useState(String(DEFAULT_ASSUMPTIONS.fxRate));
  const [freight, setFreight] = useState(String(DEFAULT_ASSUMPTIONS.freightPerCbm));
  const [adminPct, setAdminPct] = useState(String(DEFAULT_ASSUMPTIONS.adminPct * 100));
  const [orderFee, setOrderFee] = useState(String(DEFAULT_ASSUMPTIONS.orderFee));
  const [packagingFee, setPackagingFee] = useState(
    String(DEFAULT_ASSUMPTIONS.packagingFee)
  );

  const calc = computeFieldQuote({
    priceRmb: num(priceRmb),
    qtyPerCarton: num(qtyPerCarton),
    cbm: num(cbm),
    cartonP: num(cartonP),
    cartonL: num(cartonL),
    cartonT: num(cartonT),
    estSellPrice: num(sellPrice),
    fxRate: num(fxRate) ?? DEFAULT_ASSUMPTIONS.fxRate,
    freightPerCbm: num(freight) ?? DEFAULT_ASSUMPTIONS.freightPerCbm,
    adminPct: (num(adminPct) ?? 30) / 100,
    orderFee: num(orderFee) ?? DEFAULT_ASSUMPTIONS.orderFee,
    packagingFee: num(packagingFee) ?? DEFAULT_ASSUMPTIONS.packagingFee,
  });

  async function runOcr() {
    if (!productPhoto) {
      toast.error("Add a product photo first");
      return;
    }
    setOcrBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", productPhoto);
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "OCR failed");
      let filled = 0;
      if (json.price_rmb != null) { setPriceRmb(String(json.price_rmb)); filled++; }
      if (json.qty_per_carton != null) { setQtyPerCarton(String(json.qty_per_carton)); filled++; }
      if (json.cbm != null) { setCbm(String(json.cbm)); filled++; }
      if (json.carton_p_cm != null) { setCartonP(String(json.carton_p_cm)); filled++; }
      if (json.carton_l_cm != null) { setCartonL(String(json.carton_l_cm)); filled++; }
      if (json.carton_t_cm != null) { setCartonT(String(json.carton_t_cm)); filled++; }
      if (json.product_name) { setProductName(json.product_name); filled++; }
      toast.success(
        filled > 0
          ? `OCR filled ${filled} field${filled === 1 ? "" : "s"} — double-check them`
          : "OCR found no usable numbers in this photo"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrBusy(false);
    }
  }

  async function uploadPhoto(file: File, kind: string): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${supplier?.id ?? "unassigned"}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("field-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) throw new Error(error.message);
    return supabase.storage.from("field-photos").getPublicUrl(path).data.publicUrl;
  }

  function save() {
    if (num(priceRmb) == null && !productPhoto) {
      toast.error("Add at least a price or a product photo");
      return;
    }
    start(async () => {
      try {
        const photoUrl = productPhoto
          ? await uploadPhoto(productPhoto, "product")
          : null;
        // A business card can only be stored on a supplier — skip it until one
        // is assigned.
        const businessCardUrl =
          cardPhoto && supplier ? await uploadPhoto(cardPhoto, "card") : null;

        await saveFieldQuote({
          supplierId: supplier?.id ?? null,
          productName: productName || null,
          photoUrl,
          businessCardUrl,
          priceRmb: num(priceRmb),
          qtyPerCarton: num(qtyPerCarton),
          cartonP: num(cartonP),
          cartonL: num(cartonL),
          cartonT: num(cartonT),
          cbm: num(cbm),
          sizeP: num(sizeP),
          sizeL: num(sizeL),
          sizeT: num(sizeT),
          fxRate: num(fxRate) ?? DEFAULT_ASSUMPTIONS.fxRate,
          freightPerCbm: num(freight) ?? DEFAULT_ASSUMPTIONS.freightPerCbm,
          adminPct: (num(adminPct) ?? 30) / 100,
          orderFee: num(orderFee) ?? DEFAULT_ASSUMPTIONS.orderFee,
          packagingFee: num(packagingFee) ?? DEFAULT_ASSUMPTIONS.packagingFee,
          estSellPrice: num(sellPrice),
          notes: notes || null,
        });
        toast.success("Saved — capture the next item");
        // Reset item fields, keep assumptions for the next capture.
        setProductPhoto(null);
        setCardPhoto(null);
        setProductName("");
        setPriceRmb("");
        setQtyPerCarton("");
        setCbm("");
        setCartonP("");
        setCartonL("");
        setCartonT("");
        setSizeP("");
        setSizeL("");
        setSizeT("");
        setSellPrice("");
        setNotes("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Photos */}
        <section className="flex flex-wrap gap-4">
          <div className="grid gap-1.5">
            <PhotoPicker
              label="Foto barang"
              placeholder="+ foto barang"
              preview={productPreview}
              onFile={setProductPhoto}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!productPhoto || ocrBusy}
              onClick={runOcr}
            >
              {ocrBusy ? "Scanning…" : "Scan photo (OCR)"}
            </Button>
          </div>
          {supplier ? (
            <PhotoPicker
              label="Foto kartu nama"
              placeholder="+ kartu nama"
              preview={cardPreview}
              onFile={setCardPhoto}
            />
          ) : (
            <div className="grid gap-1.5">
              <Label className="text-xs">Foto kartu nama</Label>
              <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed p-2 text-center text-[11px] text-muted-foreground">
                Assign a supplier first to attach a business card
              </div>
            </div>
          )}
        </section>

        {/* Data */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="product_name">Product name</Label>
            <Input
              id="product_name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="price_rmb">Price (RMB)</Label>
            <Input
              id="price_rmb"
              type="number"
              step="0.01"
              min={0}
              value={priceRmb}
              onChange={(e) => setPriceRmb(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qty_ctn">Qty / Carton</Label>
            <Input
              id="qty_ctn"
              type="number"
              min={0}
              value={qtyPerCarton}
              onChange={(e) => setQtyPerCarton(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cbm">CBM (if supplier gives it)</Label>
            <Input
              id="cbm"
              type="number"
              step="0.0001"
              min={0}
              value={cbm}
              onChange={(e) => setCbm(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>…or Carton P×L×T (cm) → CBM auto</Label>
            <div className="flex items-center gap-1">
              <Input type="number" min={0} placeholder="P" value={cartonP}
                onChange={(e) => setCartonP(e.target.value)} className="w-20" />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min={0} placeholder="L" value={cartonL}
                onChange={(e) => setCartonL(e.target.value)} className="w-20" />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min={0} placeholder="T" value={cartonT}
                onChange={(e) => setCartonT(e.target.value)} className="w-20" />
            </div>
            {cbm.trim() === "" && calc.cbmEffective != null ? (
              <p className="text-xs text-muted-foreground">
                CBM = {calc.cbmEffective.toFixed(4)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Product size P×L×T (cm, optional)</Label>
            <div className="flex items-center gap-1">
              <Input type="number" min={0} placeholder="P" value={sizeP}
                onChange={(e) => setSizeP(e.target.value)} className="w-20" />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min={0} placeholder="L" value={sizeL}
                onChange={(e) => setSizeL(e.target.value)} className="w-20" />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min={0} placeholder="T" value={sizeT}
                onChange={(e) => setSizeT(e.target.value)} className="w-20" />
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        <Button onClick={save} disabled={pending} size="lg">
          {pending ? "Saving…" : "Save quotation"}
        </Button>
      </div>

      {/* Live costing panel */}
      <aside className="space-y-4">
        <section className="rounded-md border bg-muted/20 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Assumptions (editable)
          </h2>
          <div className="grid gap-2">
            <AssumptionInput label="RMB→IDR Rate" value={fxRate} onChange={setFxRate} />
            <AssumptionInput label="Freight IDR/CBM" value={freight} onChange={setFreight} />
            <AssumptionInput label="Admin %" value={adminPct} onChange={setAdminPct} suffix="%" />
            <AssumptionInput label="Order Fee (IDR)" value={orderFee} onChange={setOrderFee} />
            <AssumptionInput label="Packaging Fee (IDR)" value={packagingFee} onChange={setPackagingFee} />
          </div>
        </section>

        <section className="rounded-md border p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Live costing
          </h2>
          <dl className="space-y-2">
            <CalcRow label="HPP Produk" value={fmtIdr(calc.hppProduk)} />
            <CalcRow label="Ongkir / unit" value={fmtIdr(calc.ongkirPerUnit)} />
            <CalcRow label="HPP Landed" value={fmtIdr(calc.hppLanded)} strong />
            <div className="border-t pt-2">
              <Label htmlFor="sell" className="text-xs">
                Est. Sell Price (IDR)
              </Label>
              <Input
                id="sell"
                type="number"
                min={0}
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="mt-1 text-right tabular-nums"
              />
            </div>
            <CalcRow
              label="Profit Margin"
              value={
                calc.marginSimple != null
                  ? `${(calc.marginSimple * 100).toFixed(1)}%`
                  : "—"
              }
              negative={calc.marginSimple != null && calc.marginSimple < 0}
            />
            <CalcRow
              label={`Margin after Admin ${adminPct || "30"}%`}
              value={
                calc.marginAfterAdmin != null
                  ? `${(calc.marginAfterAdmin * 100).toFixed(1)}%`
                  : "—"
              }
              negative={calc.marginAfterAdmin != null && calc.marginAfterAdmin < 0}
            />
          </dl>
        </section>
      </aside>
    </div>
  );
}

// Photo slot that offers BOTH camera and gallery. The big tile and the
// "Gallery" button open the file picker (photo library on a phone); the
// "Camera" button opens the camera directly via the capture attribute.
function PhotoPicker({
  label,
  placeholder,
  preview,
  onFile,
}: {
  label: string;
  placeholder: string;
  preview: string | null;
  onFile: (f: File | null) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          placeholder
        )}
      </button>
      <div className="flex w-32 gap-1">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="flex-1"
          onClick={() => cameraRef.current?.click()}
        >
          Camera
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="flex-1"
          onClick={() => galleryRef.current?.click()}
        >
          Gallery
        </Button>
      </div>
    </div>
  );
}

function AssumptionInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-28 text-right text-xs tabular-nums"
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm tabular-nums",
          strong && "font-semibold",
          negative && "text-destructive"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
