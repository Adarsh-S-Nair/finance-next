"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";

const inputClassName =
  "flex h-11 w-full rounded-lg border-0 bg-zinc-200/50 px-4 py-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-transparent focus:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();

  const redirectTo = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL
      || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/auth/callback?next=/auth/reset-password`;
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setToast({ title: "Reset email failed", description: error.message, variant: "error" });
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
        <p className="text-sm leading-6 text-zinc-500">Enter your email and we&apos;ll send you a secure link to reset it.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-800">Email</label>
          <input className={inputClassName} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <Button type="submit" fullWidth disabled={isLoading} className="h-11">
          {isLoading ? "Sending reset link..." : "Send reset link"}
        </Button>
      </form>

      <div className="text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/auth" className="font-medium text-zinc-900 hover:text-zinc-700">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
