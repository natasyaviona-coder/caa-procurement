"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateFile } from "../actions";

// Translate this sheet's Chinese product names to English (stored on the file).
export function TranslateButton({
  fileId,
  sheetIndex,
  translated,
}: {
  fileId: string;
  sheetIndex: number;
  translated: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const { translated: n } = await translateFile(fileId, sheetIndex);
            toast.success(`Translated ${n} product name${n === 1 ? "" : "s"}`);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Translation failed");
          }
        })
      }
    >
      <Languages className="size-4" />
      {pending
        ? "Translating…"
        : translated
          ? "Re-translate"
          : "Translate to English"}
    </Button>
  );
}
