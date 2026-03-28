"use client";

import Link from "next/link";
import ForgotPasswordForm from "../../../components/auth/ForgotPasswordForm";
import PublicRoute from "../../../components/PublicRoute";
import RouteTransition from "../../../components/RouteTransition";

export default function ForgotPasswordPage() {
  return (
    <PublicRoute>
      <RouteTransition>
        <div className="min-h-screen w-full flex bg-white text-zinc-900">
          <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#3f3f46,transparent)] opacity-40"></div>
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

            <Link href="/" className="absolute top-8 left-8 z-20 group">
              <span
                aria-hidden
                className="block h-12 w-12 bg-white flex-shrink-0 transition-opacity group-hover:opacity-80"
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
            </Link>

            <div className="relative z-10 max-w-lg text-white">
              <h2 className="text-4xl font-bold tracking-tight mb-4">Get back into your account.</h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                We&apos;ll email you a secure link so you can choose a new password.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-24 relative">
            <Link href="/auth" className="lg:hidden absolute top-8 left-8 text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Back to sign in
            </Link>

            <div className="w-full max-w-sm">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </RouteTransition>
    </PublicRoute>
  );
}
