"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../components/ToastProvider";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const { setToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkRecoverySession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasRecoverySession(Boolean(data.session));
      setIsCheckingSession(false);
    };

    checkRecoverySession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setHasRecoverySession(Boolean(session));
        setIsCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setToast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      setToast({
        title: "Passwords do not match",
        description: "Please enter the same password twice.",
        variant: "error",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setToast({
        title: "Password reset failed",
        description: error.message,
        variant: "error",
      });
      setIsLoading(false);
      return;
    }

    setToast({
      title: "Password updated",
      description: "You can now sign in with your new password.",
      variant: "success",
    });

    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        <div className="w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-zinc-500">
              {hasRecoverySession
                ? "Choose a new password for your account."
                : "This reset link is invalid or has expired. Request a fresh one to continue."}
            </p>
          </div>

          {hasRecoverySession ? (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-zinc-900">New password</label>
                <input
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-zinc-900">Confirm new password</label>
                <input
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white bg-zinc-900 text-white hover:bg-zinc-900/90 h-10 py-2 w-full"
                disabled={isLoading}
              >
                {isLoading ? "Updating password..." : "Update password"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <Link
                href="/auth/forgot-password"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-900/90"
              >
                Request a new reset link
              </Link>
            </div>
          )}

          <div className="text-sm text-zinc-500">
            <Link href="/auth" className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
