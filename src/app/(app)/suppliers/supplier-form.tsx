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
import { CONTACT_CHANNELS, SUPPLIER_PLATFORMS } from "@/lib/enums";
import type { Database } from "@/lib/types/database";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

export function SupplierForm({
  initial,
  action,
  submitLabel,
  listHref = "/suppliers",
  successMessage = "Supplier saved successfully",
}: {
  initial?: Partial<SupplierRow>;
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
        const formData = new FormData(e.currentTarget);
        start(async () => {
          try {
            await action(formData);
            toast.success(successMessage);
            router.push(listHref);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <FormSection
        title="Identity"
        description="Who the supplier is and how you reach them."
      >
        <Field label="Name" htmlFor="name" required full>
          <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
        </Field>

        <Field label="Contact channel" htmlFor="contact_channel">
          <select
            id="contact_channel"
            name="contact_channel"
            defaultValue={initial?.contact_channel ?? ""}
            className={selectClass}
          >
            <option value="">—</option>
            {CONTACT_CHANNELS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Contact handle" htmlFor="contact_handle">
          <Input
            id="contact_handle"
            name="contact_handle"
            placeholder="WeChat ID / phone / email"
            defaultValue={initial?.contact_handle ?? ""}
          />
        </Field>

        <Field label="Platform" htmlFor="platform">
          <select
            id="platform"
            name="platform"
            defaultValue={initial?.platform ?? ""}
            className={selectClass}
          >
            <option value="">—</option>
            {SUPPLIER_PLATFORMS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Typical lead time (days)" htmlFor="typical_lead_time_days">
          <Input
            id="typical_lead_time_days"
            name="typical_lead_time_days"
            type="number"
            min={0}
            defaultValue={initial?.typical_lead_time_days ?? ""}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Terms & notes"
        description="Commercial terms and anything worth remembering."
      >
        <Field label="Payment terms" htmlFor="payment_terms" full>
          <Input
            id="payment_terms"
            name="payment_terms"
            placeholder="e.g. 30% DP, 70% before shipment"
            defaultValue={initial?.payment_terms ?? ""}
          />
        </Field>

        <Field label="Address" htmlFor="address" full>
          <Textarea
            id="address"
            name="address"
            rows={2}
            defaultValue={initial?.address ?? ""}
          />
        </Field>

        <Field label="Reliability notes" htmlFor="reliability_notes" full>
          <Textarea
            id="reliability_notes"
            name="reliability_notes"
            rows={3}
            defaultValue={initial?.reliability_notes ?? ""}
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
