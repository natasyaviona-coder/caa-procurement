"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type Box = { x: number; y: number; width: number; height: number };

const clamp = (n: number) => Math.max(0, Math.min(1, n));

// Drag a rectangle over the screenshot to set the crop. Works with mouse and
// touch (pointer events). Coordinates are stored as 0..1 fractions of the
// displayed image, which map directly onto the natural image when cropping.
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
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Box | null>(initialBox);

  function toFrac(clientX: number, clientY: number) {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clamp((clientX - r.left) / r.width), y: clamp((clientY - r.top) / r.height) };
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toFrac(e.clientX, e.clientY);
    start.current = p;
    setRect({ x: p.x, y: p.y, width: 0, height: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    const p = toFrac(e.clientX, e.clientY);
    const s = start.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      width: Math.abs(p.x - s.x),
      height: Math.abs(p.y - s.y),
    });
  }
  function onUp() {
    start.current = null;
  }

  const valid = rect != null && rect.width > 0.02 && rect.height > 0.02;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 p-4">
      <p className="text-sm text-white">Drag a box around the product, then Apply.</p>
      <div
        className="relative max-h-[75vh] max-w-[92vw] touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="max-h-[75vh] max-w-[92vw] select-none rounded"
        />
        {rect ? (
          <div
            className="pointer-events-none absolute border-2 border-brand"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          />
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!valid}
          onClick={() => valid && rect && onApply(rect)}
        >
          Apply crop
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
