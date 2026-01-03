"use client";
import Tabs from "../../components/ui/Tabs";
import LoginForm from "../../components/auth/LoginForm";
import SignupForm from "../../components/auth/SignupForm";
import Link from "next/link";
import { motion } from "framer-motion";
import PublicRoute from "../../components/PublicRoute";
import RouteTransition from "../../components/RouteTransition";

export default function AuthPage() {
  return (
    <PublicRoute>
      <RouteTransition>
        <div className="min-h-screen w-full flex bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white">
          {/* Left Side - Visual/Branding */}
          <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#3f3f46,transparent)] opacity-40"></div>
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

            {/* Back to Home (Logo) */}
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
              <div className="mb-8">
                <div className="h-10 w-10 bg-white rounded-lg mb-6"></div>
                <h2 className="text-4xl font-bold tracking-tight mb-4">Manage your finances with confidence.</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  "Zentari has completely transformed how I track my spending. It's beautiful, fast, and actually makes me want to look at my budget."
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-full bg-zinc-700 border-2 border-zinc-900"></div>
                  ))}
                </div>
                <p className="text-sm text-zinc-400">Trusted by 10,000+ users</p>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-24 relative">
            {/* Mobile Back Button (visible only on small screens) */}
            <Link href="/" className="lg:hidden absolute top-8 left-8 text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Back to home
            </Link>

            <div className="w-full max-w-sm space-y-8">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-zinc-500 mt-2">Enter your details to access your account</p>
              </div>

              <Tabs
                tabs={[
                  { key: "login", label: "Sign in", content: <LoginForm /> },
                  { key: "signup", label: "Create account", content: <SignupForm /> },
                ]}
                initialKey="login"
                variant="zinc"
                className="w-full"
              />

              <p className="px-8 text-center text-xs text-zinc-400">
                By clicking continue, you agree to our{" "}
                <Link href="/terms" className="underline underline-offset-4 hover:text-zinc-900">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-zinc-900">
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
