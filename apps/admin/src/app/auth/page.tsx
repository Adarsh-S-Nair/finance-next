"use client";

import { useState } from "react";
import { Button } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";
import { FcGoogle } from "react-icons/fc";

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
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-[var(--color-fg)] mb-2">
            Zervo Admin
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Restricted access. Sign in with Google.
          </p>
        </div>
        <Button
          variant="outline"
          fullWidth
          loading={loading}
          onClick={handleSignIn}
          className="h-11"
        >
          <FcGoogle className="mr-2 h-5 w-5" />
          Continue with Google
        </Button>
        {error && (
          <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    </main>
  );
}
