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
import type { Database } from "@/lib/types/database";

type QuoteRow = Database["public"]["Tables"]["supplier_quotes"]["Row"];

export function QuoteForm({
  initial,
  suppliers,
  products,
  action,
  submitLabel,
  listHref = "/quotes",
  successMessage = "Quote saved successfully",
}: {
  initial?: Partial<QuoteRow>;
  suppliers: { id: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
  action: (formData: FormData) => Promise<unknown>;
  submitLabel: string;
  listHref?: string;
  successMessage?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

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
      <FormSection
        title="Quote"
        description="Which supplier quoted, for which product, and at what price."
      >
        <Field label="Supplier" htmlFor="supplier_id" required full>
          <select
            id="supplier_id"
            name="supplier_id"
            defaultValue={initial?.supplier_id ?? ""}
            required
            className={selectClass}
          >
            <option value="">— select supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Product"
          htmlFor="product_id"
          full
          hint="Leave unmapped to log the price now and assign a SKU later."
        >
          <select
            id="product_id"
            name="product_id"
            defaultValue={initial?.product_id ?? ""}
            className={selectClass}
          >
            <option value="">— unmapped —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="RMB price" htmlFor="rmb_price" required>
          <Input
            id="rmb_price"
            name="rmb_price"
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial?.rmb_price ?? ""}
            required
          />
        </Field>

        <Field label="MOQ" htmlFor="moq">
          <Input
            id="moq"
            name="moq"
            type="number"
            min={1}
            defaultValue={initial?.moq ?? ""}
          />
        </Field>

        <Field label="Quote date" htmlFor="quote_date" required>
          <Input
            id="quote_date"
            name="quote_date"
            type="date"
            defaultValue={initial?.quote_date ?? today}
            required
          />
        </Field>

        <Field label="Valid until" htmlFor="valid_until">
          <Input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={initial?.valid_until ?? ""}
          />
        </Field>

        <Field label="Notes" htmlFor="notes" full>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ""}
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
