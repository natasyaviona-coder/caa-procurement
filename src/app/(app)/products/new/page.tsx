import { redirect } from "next/navigation";
import { requireProfile, canWrite } from "@/lib/auth";
import { ProductForm } from "../product-form";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/products");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a SKU with its spec and current stock position.
        </p>
      </div>
      <ProductForm action={createProduct} submitLabel="Create product" />
    </div>
  );
}
