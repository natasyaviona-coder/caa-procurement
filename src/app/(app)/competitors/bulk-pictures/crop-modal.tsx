"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type Box = { x: number; y: number; width: number; height: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// A fixed 1:1 (square) crop window you drag to move and resize from the corner.
// Position over the product, then Apply. Works with mouse and touch.
export function CropModal({
  src,
  initialBox,
  onApply,
  onClose,
}: {
  src: string;
  initialBox: Box | null;
  onApply: (box: Box) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Square in displayed pixels: { left, top, size }.
  const [sq, setSq] = useState<{ left: number; top: number; size: number } | null>(
    null
  );
  const drag = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: { left: number; top: number; size: number };
  } | null>(null);

  function dims() {
    const el = imgRef.current;
    if (!el) return { w: 0, h: 0 };
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function initFromImage() {
    const { w, h } = dims();
    if (w === 0 || h === 0) return;
    // Seed from the AI box (made square) or a centered 60% square.
    let size = Math.round(0.6 * Math.min(w, h));
    let left = Math.round((w - size) / 2);
    let top = Math.round((h - size) / 2);
    if (initialBox && initialBox.width > 0 && initialBox.height > 0) {
      size = Math.round(Math.min(initialBox.width * w, initialBox.height * h));
      size = clamp(size, 32, Math.min(w, h));
      left = clamp(Math.round(initialBox.x * w), 0, w - size);
      top = clamp(Math.round(initialBox.y * h), 0, h - size);
    }
    setSq({ left, top, size });
  }

  function startMove(e: React.PointerEvent) {
    if (!sq) return;
    e.preventDefault();
    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    drag.current = { mode: "move", startX: e.clientX, startY: e.clientY, orig: { ...sq } };
  }
  function startResize(e: React.PointerEvent) {
    if (!sq) return;
    e.preventDefault();
    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    drag.current = { mode: "resize", startX: e.clientX, startY: e.clientY, orig: { ...sq } };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !sq) return;
    const { w, h } = dims();
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    const o = drag.current.orig;
    if (drag.current.mode === "move") {
      setSq({
        left: clamp(o.left + dx, 0, w - o.size),
        top: clamp(o.top + dy, 0, h - o.size),
        size: o.size,
      });
    } else {
      let size = o.size + Math.max(dx, dy);
      size = clamp(size, 32, Math.min(w - o.left, h - o.top));
      setSq({ left: o.left, top: o.top, size });
    }
  }
  function endDrag() {
    drag.current = null;
  }

  function apply() {
    const { w, h } = dims();
    if (!sq || w === 0 || h === 0) return;
    onApply({ x: sq.left / w, y: sq.top / h, width: sq.size / w, height: sq.size / h });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 p-4">
      <p className="text-sm text-white">
        Drag the square to move it, drag the corner to resize, then Apply.
      </p>
      <div
        ref={containerRef}
        className="relative touch-none select-none"
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={initFromImage}
          className="max-h-[74vh] max-w-[92vw] select-none rounded"
        />
        {sq ? (
          <div
            onPointerDown={startMove}
            className="absolute cursor-move border-2 border-brand"
            style={{
              left: sq.left,
              top: sq.top,
              width: sq.size,
              height: sq.size,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            <div
              onPointerDown={startResize}
              className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-sm border-2 border-brand bg-white"
            />
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" disabled={!sq} onClick={apply}>
          Apply crop
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
