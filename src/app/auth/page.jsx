"use client";

import Link from "next/link";
import Tabs from "../../components/ui/Tabs";
import LoginForm from "../../components/auth/LoginForm";
import SignupForm from "../../components/auth/SignupForm";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";

export default function AuthPage() {
  return (
    <PublicRoute>
      <RouteTransition>
        <div className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-white lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="hidden border-r border-zinc-200 bg-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <span
                  aria-hidden
                  className="block h-10 w-10 bg-zinc-900"
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
                <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900">ZENTARI</span>
              </Link>

              <div className="mt-20 max-w-xl">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Personal finance, without the mess</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 xl:text-5xl">
                  Sign in to your financial workspace.
                </h1>
                <p className="mt-5 text-base leading-7 text-zinc-600 xl:text-lg">
                  Track spending, stay on top of budgets, and keep an eye on your investments from one clean dashboard.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Cash flow", "See where your money goes"],
                ["Budgets", "Stay aligned month to month"],
                ["Investments", "Keep portfolio context nearby"],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium text-zinc-900">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600">{copy}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-6 lg:px-12 xl:px-16">
            <div className="w-full max-w-md space-y-8">
              <div className="space-y-3">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 lg:hidden">
                  ← Back home
                </Link>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">Welcome</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">Use your email to sign in or create a new account.</p>
                </div>
              </div>

              <Tabs
                tabs={[
                  { key: "login", label: "Sign in", content: <LoginForm /> },
                  { key: "signup", label: "Create account", content: <SignupForm /> },
                ]}
                initialKey="login"
                variant="zinc"
              />

              <p className="text-center text-xs leading-5 text-zinc-400">
                By continuing, you agree to our <Link href="/docs/terms" className="underline underline-offset-4 hover:text-zinc-700">Terms</Link> and <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-zinc-700">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </RouteTransition>
    </PublicRoute>
  );
}
