"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";
import { BRAND } from "../../config/brand";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";
import { GoogleSignInButton } from "@zervo/ui";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();

  // Match the landing page: light-first. Dashboard/app can still
  // set `.dark` via its own theme state without us fighting.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Exchange page decides /dashboard vs /setup based on whether the
        // user has accounts — no need to hardcode a `next` here.
        redirectTo: `${window.location.origin}/auth/callback/exchange`,
      },
    });
    if (error) {
      setToast({
        title: "Sign in failed",
        description: error.message,
        variant: "error",
      });
      setIsLoading(false);
    }
    // On success the browser redirects to Google OAuth — no state cleanup needed.
  };

  return (
    <PublicRoute>
      <RouteTransition>
        <div className="relative min-h-screen bg-[var(--color-content-bg)] text-[var(--color-fg)] overflow-hidden">
          {/* Topbar with logo */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-content-bg)]/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center px-5 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="block h-10 w-10 bg-[var(--color-fg)]"
                  style={{
                    WebkitMaskImage: "url(/logo.svg)",
                    maskImage: "url(/logo.svg)",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
                <span
                  className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-fg)]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {BRAND.name}
                </span>
              </Link>
            </div>
          </header>

          {/* Centered auth content. Copy is neutral ("continue") rather
              than "sign in" / "welcome back" because Google OAuth handles
              both first-time sign-up and returning sign-in on the same
              button — new users should not feel like they're in the wrong
              place. */}
          <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Continue to {BRAND.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Sign in or create an account — one tap with Google.
              </p>

              <div className="mt-8">
                <GoogleSignInButton loading={isLoading} onClick={handleGoogleSignIn} />
              </div>

              <p className="mt-8 text-xs leading-5 text-[var(--color-muted)]">
                By continuing, you agree to our{" "}
                <Link href="/docs/terms" className="underline underline-offset-4 hover:text-[var(--color-fg)]">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-[var(--color-fg)]">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </RouteTransition>
    </PublicRoute>
  );
}
