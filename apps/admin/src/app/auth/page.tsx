"use client";

import { useState } from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-content-bg)] text-[var(--color-fg)] overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-content-bg)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-4 sm:px-6 lg:px-8">
          <BrandMark />
        </div>
      </header>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
            Admin sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            Restricted access. Continue with your Google account.
          </p>

          <div className="mt-8">
            <GoogleSignInButton loading={loading} onClick={handleSignIn} />
          </div>

          {error && (
            <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
          )}

          <p className="mt-8 text-xs leading-5 text-[var(--color-muted)]">
            Not an admin?{" "}
            <Link
              href="https://zervo.app"
              className="underline underline-offset-4 hover:text-[var(--color-fg)]"
            >
              Go to Zervo
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
