import { redirect } from "next/navigation";
import { requireProfile, canWrite } from "@/lib/auth";
import { SupplierForm } from "../supplier-form";
import { createSupplier } from "../actions";

export default async function NewSupplierPage() {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/suppliers");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New supplier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a factory, 1688 seller, or direct contact to your supplier list.
        </p>
      </div>
      <SupplierForm action={createSupplier} submitLabel="Create supplier" />
    </div>
  );
}
