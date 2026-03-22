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
        <div className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-white">
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="flex items-start justify-between gap-4">
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
                {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
                  <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
                    TEST
                  </span>
                )}
              </Link>

              <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
                Back home
              </Link>
            </div>

            <div className="flex flex-1 items-center py-10 lg:py-14">
              <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
                <div className="max-w-2xl">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Personal finance, without the mess</p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
                    Sign in to your financial workspace.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                    Track spending, stay on top of budgets, and keep an eye on your investments from one clean dashboard.
                  </p>
                </div>

                <div className="w-full max-w-md lg:ml-auto">
                  <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Welcome</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">Use your email to sign in or create a new account.</p>
                    </div>

                    <Tabs
                      tabs={[
                        { key: "login", label: "Sign in", content: <LoginForm /> },
                        { key: "signup", label: "Create account", content: <SignupForm /> },
                      ]}
                      initialKey="login"
                      variant="zinc"
                    />
                  </div>

                  <p className="mt-5 text-center text-xs leading-5 text-zinc-400">
                    By continuing, you agree to our <Link href="/docs/terms" className="underline underline-offset-4 hover:text-zinc-700">Terms</Link> and <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-zinc-700">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RouteTransition>
    </PublicRoute>
  );
}
