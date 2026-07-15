"use client";

import { useState } from "react";

// A thumbnail that opens a big centered popout on click. Click anywhere (or
// Esc) to close. Used for competitor product photos.
export function PhotoPopout({
  src,
  alt = "",
  className = "h-24 w-24 rounded object-cover",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block cursor-zoom-in"
        aria-label="Enlarge photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className={className} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[88vh] max-w-[92vw] rounded-md object-contain shadow-xl"
          />
        </div>
      ) : null}
    </>
  );
}
