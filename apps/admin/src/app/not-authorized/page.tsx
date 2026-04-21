import Link from "next/link";
import { Button } from "@zervo/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function NotAuthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-3">
          Not authorized
        </h1>
        <p className="text-sm text-[var(--color-muted)] mb-8">
          Your account is not on the admin allowlist. If you think this is a
          mistake, contact Adarsh.
        </p>
        <div className="flex items-center justify-center gap-3">
          <SignOutButton />
          <Link href="https://zervo.app">
            <Button variant="ghost">Go to Zervo</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
