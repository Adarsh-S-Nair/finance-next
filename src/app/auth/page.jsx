"use client";

import { useEffect } from "react";
import Link from "next/link";
import LoginForm from "../../components/auth/LoginForm";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";
import { BRAND } from "../../config/brand";

const isMock = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

export default function AuthPage() {
  // Match the landing page: light-first. Dashboard/app can still
  // set `.dark` via its own theme state without us fighting.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <PublicRoute>
      <RouteTransition>
        <div className="relative min-h-screen bg-[var(--color-content-bg)] text-[var(--color-fg)] overflow-hidden">
          {/* Topbar with logo */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-content-bg)]/85 backdrop-blur border-b border-[var(--color-border)]">
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
                  className="text-lg font-semibold uppercase tracking-[0.22em] text-[var(--color-fg)]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  {BRAND.name}
                </span>
              </Link>
            </div>
          </header>

          {/* Centered login content */}
          <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Sign in
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Welcome back. Sign in to continue.
              </p>

              <div className="mt-8">
                <LoginForm />
              </div>

              {isMock && (
                <p className="mt-6 text-sm text-[var(--color-muted)]">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/setup"
                    className="font-medium text-[var(--color-fg)] underline underline-offset-4 transition-colors hover:text-[var(--color-muted)]"
                  >
                    Get started
                  </Link>
                </p>
              )}

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
