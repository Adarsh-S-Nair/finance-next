"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/reset-password`;
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setToast({
        title: "Reset email failed",
        description: error.message,
        variant: "error",
      });
    } else {
      setToast({
        title: "Check your email",
        description: "If an account exists for that email, we sent a password reset link.",
        variant: "success",
        durationMs: 5000,
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Forgot your password?</h1>
        <p className="text-sm text-zinc-500">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none text-zinc-900">Email</label>
          <input
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white bg-zinc-900 text-white hover:bg-zinc-900/90 h-10 py-2 w-full"
          disabled={isLoading}
        >
          {isLoading ? "Sending reset link..." : "Send reset link"}
        </button>
      </form>

      <div className="text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/auth" className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
