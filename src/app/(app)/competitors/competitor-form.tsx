"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSection, Field, FormActions } from "@/components/ui/form-section";
import type { Database } from "@/lib/types/database";

type CompetitorRow = Database["public"]["Tables"]["competitors"]["Row"];

export function CompetitorForm({
  initial,
  action,
  submitLabel,
}: {
  initial?: Partial<CompetitorRow>;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await action(fd);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <FormSection
        title="Competitor"
        description="A market seller you benchmark your sourcing against."
        columns={1}
      >
        <Field label="Competitor name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
        </Field>
        <Field label="Specialization" htmlFor="specialization">
          <Input
            id="specialization"
            name="specialization"
            placeholder="e.g. panci, pisau"
            defaultValue={initial?.specialization ?? ""}
          />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ""}
          />
        </Field>
      </FormSection>

      <FormActions>
        <LinkButton href="/competitors" variant="ghost">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
