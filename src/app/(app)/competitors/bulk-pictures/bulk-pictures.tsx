"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPopout } from "@/components/photo-popout";
import { createClient } from "@/lib/supabase/client";
import { reverseHppRmb } from "@/lib/competitor-costing";
import { saveBulkCompetitorProducts, type BulkPictureItem } from "../actions";
import { CropModal, type Box } from "./crop-modal";

type Item = {
  id: string;
  file: File;
  fullUrl: string; // object URL of the original screenshot
  croppedUrl: string; // cropped data URL (falls back to full)
  useFull: boolean;
  box: Box | null;
  status: "analyzing" | "ready" | "error";
  error?: string;
  name: string;
  priceIdr: string;
  info: string;
  rmb: string;
};

type Settings = { fx: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToDataUrl(objectUrl: string, box: Box | null): Promise<string> {
  const img = await loadImage(objectUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = W;
  let sh = H;
  if (box && box.width > 0 && box.height > 0) {
    sx = Math.max(0, Math.min(1, box.x)) * W;
    sy = Math.max(0, Math.min(1, box.y)) * H;
    sw = Math.min(1, box.width) * W;
    sh = Math.min(1, box.height) * H;
    if (sx + sw > W) sw = W - sx;
    if (sy + sh > H) sh = H - sy;
  }
  if (sw < 4 || sh < 4) return objectUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return objectUrl;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function BulkPictures({ settings }: { settings: Settings }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [saving, startSaving] = useTransition();
  const [cropId, setCropId] = useState<string | null>(null);
  // Reverse-costing percentages for HPP RMB — independent of the FEI Settings
  // (which use a different margin). Defaults match Nat's formula.
  const [cost, setCost] = useState({
    ongkir: 44,
    admin: 30,
    margin: 10,
    fx: settings.fx,
  });
  const router = useRouter();

  function calcRmb(priceStr: string, c = cost): string {
    const n = Number(priceStr.replace(/[^0-9.]/g, ""));
    const rmb = reverseHppRmb(Number.isFinite(n) ? n : null, {
      fxRate: c.fx,
      adminPct: c.admin / 100,
      marginPct: c.margin / 100,
      ongkirPct: c.ongkir / 100,
    });
    return rmb != null ? rmb.toFixed(2) : "";
  }

  function updateCost(patchCost: Partial<typeof cost>) {
    const next = { ...cost, ...patchCost };
    setCost(next);
    setItems((prev) => prev.map((it) => ({ ...it, rmb: calcRmb(it.priceIdr, next) })));
  }

  function patch(id: string, next: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }

  async function applyCrop(id: string, box: Box) {
    const it = items.find((x) => x.id === id);
    setCropId(null);
    if (!it) return;
    const cropped = await cropToDataUrl(it.fullUrl, box);
    patch(id, { box, croppedUrl: cropped, useFull: false });
  }

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast.error("Please choose image files");
      return;
    }
    for (const file of imgs) {
      const id = crypto.randomUUID();
      const fullUrl = URL.createObjectURL(file);
      setItems((prev) => [
        ...prev,
        {
          id,
          file,
          fullUrl,
          croppedUrl: fullUrl,
          useFull: false,
          box: null,
          status: "analyzing",
          name: "",
          priceIdr: "",
          info: "",
          rmb: "",
        },
      ]);
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/competitor-vision", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Analysis failed");
        const box: Box | null = json.product_box ?? null;
        const cropped = await cropToDataUrl(fullUrl, box);
        const priceStr = json.price_idr != null ? String(json.price_idr) : "";
        patch(id, {
          status: "ready",
          box,
          croppedUrl: cropped,
          name: json.name ?? "",
          priceIdr: priceStr,
          info: json.info ?? "",
          rmb: calcRmb(priceStr),
        });
      } catch (err) {
        patch(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Analysis failed",
        });
      }
    }
  }

  function saveAll() {
    const ready = items.filter((it) => it.status !== "analyzing");
    if (ready.length === 0) {
      toast.error("Nothing to save yet");
      return;
    }
    startSaving(async () => {
      try {
        const supabase = createClient();
        const payload: BulkPictureItem[] = [];
        for (const it of ready) {
          let photoUrl: string | null = null;
          const blob = it.useFull ? it.file : dataUrlToBlob(it.croppedUrl);
          const ext = it.useFull ? it.file.name.split(".").pop() || "jpg" : "jpg";
          const path = `competitor-bulk/${it.id}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("field-photos")
            .upload(path, blob, {
              contentType: it.useFull ? it.file.type || "image/jpeg" : "image/jpeg",
              upsert: true,
            });
          if (!upErr) {
            photoUrl = supabase.storage.from("field-photos").getPublicUrl(path).data
              .publicUrl;
          }
          const price = Number(it.priceIdr.replace(/[^0-9.]/g, ""));
          const rmb = Number(it.rmb.replace(/[^0-9.]/g, ""));
          payload.push({
            competitorId: null,
            name: it.name.trim(),
            priceIdr: Number.isFinite(price) && price > 0 ? price : null,
            info: it.info.trim() || null,
            rmb: Number.isFinite(rmb) && rmb > 0 ? rmb : null,
            photoUrl,
          });
        }
        const { inserted } = await saveBulkCompetitorProducts(payload);
        toast.success(`Saved ${inserted} product${inserted === 1 ? "" : "s"}`);
        router.push("/competitors?tab=unassigned");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const analyzing = items.some((it) => it.status === "analyzing");

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void addFiles(files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          Add pictures
        </Button>
        {items.length > 0 ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saving || analyzing}
              onClick={saveAll}
            >
              {saving
                ? "Saving…"
                : analyzing
                  ? "Analyzing…"
                  : `Save all (${items.filter((i) => i.status !== "analyzing").length})`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setItems([])}
            >
              Clear
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">
          HPP RMB = price × (1 − ongkir − admin − margin) ÷ FX
        </span>
        <CostInput label="Ongkir %" value={cost.ongkir} onChange={(v) => updateCost({ ongkir: v })} />
        <CostInput label="Admin %" value={cost.admin} onChange={(v) => updateCost({ admin: v })} />
        <CostInput label="Margin %" value={cost.margin} onChange={(v) => updateCost({ margin: v })} />
        <CostInput label="FX" value={cost.fx} onChange={(v) => updateCost({ fx: v })} wide />
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Add marketplace screenshots (Shopee / TikTok). Each one is analyzed for
          name, price, size and a cropped product photo — review, edit, then Save all.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row"
            >
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                {it.status === "analyzing" ? (
                  <div className="flex h-28 w-28 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    Analyzing…
                  </div>
                ) : (
                  <PhotoPopout
                    src={it.useFull ? it.fullUrl : it.croppedUrl}
                    className="h-28 w-28 rounded border object-contain"
                  />
                )}
                {it.status === "ready" ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setCropId(it.id)}
                      className="text-[11px] font-medium text-brand underline-offset-2 hover:underline"
                    >
                      Crop
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(it.id, { useFull: !it.useFull })}
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {it.useFull ? "Use cropped" : "Use full image"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Product name</Label>
                  <Input
                    value={it.name}
                    onChange={(e) => patch(it.id, { name: e.target.value })}
                    placeholder={it.status === "error" ? it.error : "Product name"}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Price (IDR)</Label>
                  <Input
                    inputMode="numeric"
                    value={it.priceIdr}
                    onChange={(e) =>
                      patch(it.id, {
                        priceIdr: e.target.value,
                        rmb: calcRmb(e.target.value),
                      })
                    }
                    className="text-right tabular-nums"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">HPP Produk (¥ RMB)</Label>
                  <Input
                    inputMode="decimal"
                    value={it.rmb}
                    onChange={(e) => patch(it.id, { rmb: e.target.value })}
                    className="bg-yellow-50 text-right font-medium tabular-nums"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Size / info</Label>
                  <Input
                    value={it.info}
                    onChange={(e) => patch(it.id, { info: e.target.value })}
                    placeholder="e.g. 14.5 x 17 cm, 4 x 160 ml"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                className="flex size-8 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {cropId
        ? (() => {
            const it = items.find((x) => x.id === cropId);
            if (!it) return null;
            return (
              <CropModal
                src={it.fullUrl}
                initialBox={it.box}
                onApply={(b) => void applyCrop(cropId, b)}
                onClose={() => setCropId(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

function CostInput({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  wide?: boolean;
}) {
  return (
    <label className="flex items-center gap-1">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`h-7 rounded border border-input bg-transparent px-1.5 text-right tabular-nums text-foreground ${wide ? "w-16" : "w-12"}`}
      />
    </label>
  );
}
