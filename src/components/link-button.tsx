import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>;

// Renders a Next Link styled as a shadcn Button. Base UI's Button primitive
// (used by the shadcn Button in this project) has no `asChild`, so we compose
// via buttonVariants instead.
export function LinkButton({ variant, size, className, ...props }: Props) {
  return (
    <Link
      {...props}
      className={cn(buttonVariants({ variant, size }), className)}
    />
  );
}
