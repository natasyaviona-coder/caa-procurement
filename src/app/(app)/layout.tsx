import { requireProfile } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <AppNav email={profile.email} role={profile.role} />
      <main className="scrollbar-thin flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
