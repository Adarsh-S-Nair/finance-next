"use client";

import Link from "next/link";
import LoginForm from "../../components/auth/LoginForm";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";

const isMock = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

export default function AuthPage() {
  return (
    <PublicRoute>
      <style>{`html, body { background: #09090b !important; }`}</style>
      <RouteTransition>
        <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
          {/* Topbar with logo */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md">
            <div className="flex items-center px-8 py-6 max-w-7xl mx-auto w-full">
              <Link href="/" className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="block h-10 w-10 bg-white"
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
                  className="text-sm font-medium tracking-[0.18em] text-white"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  ZERVO
                </span>
              </Link>
            </div>
          </header>

          {/* Centered login content */}
          <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
            <div className="w-full max-w-sm">
              <h1
                className="text-3xl font-light uppercase tracking-[0.1em] text-white"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Sign in
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Welcome back. Sign in to continue.
              </p>

              <div className="mt-8">
                <LoginForm dark />
              </div>

              {isMock && (
                <p className="mt-6 text-sm text-zinc-400">
                  Don&apos;t have an account?{" "}
                  <Link href="/setup" className="font-medium text-white underline underline-offset-4 hover:text-zinc-300">
                    Get started
                  </Link>
                </p>
              )}

              <p className="mt-8 text-xs leading-5 text-zinc-500">
                By continuing, you agree to our{" "}
                <Link href="/docs/terms" className="underline underline-offset-4 hover:text-zinc-300">Terms</Link>{" "}
                and{" "}
                <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-zinc-300">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </RouteTransition>
    </PublicRoute>
  );
}
