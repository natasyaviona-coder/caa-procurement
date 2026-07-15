"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormSection,
  Field,
  FormActions,
  selectClass,
} from "@/components/ui/form-section";
import { BRANDS } from "@/lib/enums";
import type { Database } from "@/lib/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function ProductForm({
  initial,
  action,
  submitLabel,
  listHref = "/products",
  successMessage = "Product saved successfully",
}: {
  initial?: Partial<ProductRow>;
  action: (formData: FormData) => Promise<unknown>;
  submitLabel: string;
  listHref?: string;
  successMessage?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await action(fd);
            toast.success(successMessage);
            router.push(listHref);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <FormSection title="Product" description="SKU, name, and how it's classified.">
        <Field label="SKU" htmlFor="sku" required>
          <Input id="sku" name="sku" defaultValue={initial?.sku ?? ""} required />
        </Field>

        <Field label="Name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
        </Field>

        <Field label="Brand" htmlFor="brand">
          <select
            id="brand"
            name="brand"
            defaultValue={initial?.brand ?? ""}
            className={selectClass}
          >
            <option value="">—</option>
            {BRANDS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category" htmlFor="category">
          <Input
            id="category"
            name="category"
            placeholder="e.g. Kitchenware"
            defaultValue={initial?.category ?? ""}
          />
        </Field>

        <Field label="Spec summary" htmlFor="spec_summary" full>
          <Textarea
            id="spec_summary"
            name="spec_summary"
            rows={2}
            placeholder="Material, size, colour…"
            defaultValue={initial?.spec_summary ?? ""}
          />
        </Field>

        <Field
          label="Photo URL"
          htmlFor="photo_url"
          full
          hint="Bulk import from supplier .xlsx files is the primary path — see README."
        >
          <Input
            id="photo_url"
            name="photo_url"
            type="url"
            placeholder="https://…"
            defaultValue={initial?.photo_url ?? ""}
          />
        </Field>
      </FormSection>

      <FormSection title="Inventory" description="Stock position used by planning.">
        <Field label="Current stock" htmlFor="current_stock_on_hand">
          <Input
            id="current_stock_on_hand"
            name="current_stock_on_hand"
            type="number"
            min={0}
            defaultValue={initial?.current_stock_on_hand ?? 0}
          />
        </Field>

        <Field label="Incoming PO qty" htmlFor="incoming_po_qty">
          <Input
            id="incoming_po_qty"
            name="incoming_po_qty"
            type="number"
            min={0}
            defaultValue={initial?.incoming_po_qty ?? 0}
          />
        </Field>
      </FormSection>

      <FormActions>
        <LinkButton href={listHref} variant="ghost">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
