"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection, Field, FormActions } from "@/components/ui/form-section";
import type { Database } from "@/lib/types/database";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

export function SettingsForm({
  initial,
  action,
}: {
  initial: SettingsRow;
  action: (formData: FormData) => Promise<unknown>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await action(fd);
            toast.success("Settings updated");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <FormSection
        title="Exchange rate & planning"
        description="Drives landed-cost costing and restock planning."
      >
        <Field label="FX rate (RMB → IDR)" htmlFor="fx_rate_rmb_idr" required>
          <Input
            id="fx_rate_rmb_idr"
            name="fx_rate_rmb_idr"
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial.fx_rate_rmb_idr}
            required
          />
        </Field>
        <Field label="Default safety stock (days)" htmlFor="default_safety_stock_days">
          <Input
            id="default_safety_stock_days"
            name="default_safety_stock_days"
            type="number"
            min={0}
            defaultValue={initial.default_safety_stock_days}
          />
        </Field>
        <Field label="Default import duty (%)" htmlFor="default_import_duty_pct">
          <Input
            id="default_import_duty_pct"
            name="default_import_duty_pct"
            type="number"
            step="0.01"
            min={0}
            defaultValue={(initial.default_import_duty_pct * 100).toFixed(2)}
          />
        </Field>
        <Field
          label="Container CBM cap"
          htmlFor="container_cbm_cap"
          hint="Reserved for shipping planning — not used in calculations yet."
        >
          <Input
            id="container_cbm_cap"
            name="container_cbm_cap"
            type="number"
            step="0.01"
            min={0}
            defaultValue={initial.container_cbm_cap ?? ""}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Costing margins"
        description="Admin % + target margin drive the competitor &ldquo;target RMB&rdquo;."
      >
        <Field label="Admin / platform fee (%)" htmlFor="default_admin_pct">
          <Input
            id="default_admin_pct"
            name="default_admin_pct"
            type="number"
            step="0.1"
            min={0}
            defaultValue={(initial.default_admin_pct * 100).toFixed(1)}
          />
        </Field>
        <Field label="Target margin (%)" htmlFor="default_target_margin_pct">
          <Input
            id="default_target_margin_pct"
            name="default_target_margin_pct"
            type="number"
            step="0.1"
            min={0}
            defaultValue={(initial.default_target_margin_pct * 100).toFixed(1)}
          />
        </Field>
      </FormSection>

      <FormActions>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </FormActions>
    </form>
  );
}
