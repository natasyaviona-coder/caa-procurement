import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            CA
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              CAA Procurement
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your workspace
            </p>
          </div>
        </div>
        <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-medium">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="grid gap-4">
            <input type="hidden" name="next" value={next ?? "/"} />
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </main>
  );
}
