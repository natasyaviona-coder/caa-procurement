import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// Shared styling for native <select> so they match the Input primitive
// (same height, radius, border, and focus ring). Use on raw <select> elements.
export const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

// A titled group of fields, rendered as a light card (Attio settings style).
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
      {title || description ? (
        <div className="border-b border-border px-5 py-3.5">
          {title ? (
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "grid gap-x-5 gap-y-4 p-5",
          columns === 2 && "sm:grid-cols-2",
          className
        )}
      >
        {children}
      </div>
    </section>
  );
}

// A single labelled control. `full` spans both columns; `hint` shows helper text.
export function Field({
  label,
  htmlFor,
  hint,
  required,
  full,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", full && "sm:col-span-2", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-muted-foreground">*</span> : null}
        </Label>
      ) : null}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// Right-aligned action bar for a form footer.
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2 pt-1", className)}>
      {children}
    </div>
  );
}
