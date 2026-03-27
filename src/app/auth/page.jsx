"use client";

import { useState } from "react";
import Link from "next/link";
import LoginForm from "../../components/auth/LoginForm";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";
import { LandingNav } from "../page";

export default function AuthPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <PublicRoute>
      <RouteTransition>
        <div className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-white">
          <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} showLinks={false} bgClass="bg-zinc-50" />

          <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl flex-col px-5 sm:px-6 lg:px-8">
            <div className="flex flex-1 items-center py-10 lg:py-14">
              <div className="grid w-full gap-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center">
                {/* Left branding panel */}
                <div className="max-w-2xl">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Personal finance, without the mess</p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
                    Sign in to your financial workspace.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                    Track spending, stay on top of budgets, and keep an eye on your investments from one clean dashboard.
                  </p>
                </div>

                {/* Right form panel */}
                <div className="w-full max-w-md lg:ml-auto">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Welcome back</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">Sign in to your account to continue.</p>
                  </div>

                  <LoginForm />

                  <p className="mt-5 text-sm text-zinc-500">
                    Don&apos;t have an account?{" "}
                    <Link href="/setup" className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700">
                      Get started
                    </Link>
                  </p>

                  <p className="mt-6 text-xs leading-5 text-zinc-400">
                    By continuing, you agree to our{" "}
                    <Link href="/docs/terms" className="underline underline-offset-4 hover:text-zinc-700">Terms</Link>{" "}
                    and{" "}
                    <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-zinc-700">Privacy Policy</Link>.
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
