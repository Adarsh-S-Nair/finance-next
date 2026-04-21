"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Button, GoogleSignInButton, GoogleIcon } from "@zervo/ui";

const inputLight =
  "flex h-11 w-full rounded-lg border-0 bg-zinc-200/50 px-4 py-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-transparent focus:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50";

const inputDark =
  "flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-white/20 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const isMock = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

export default function LoginForm({ dark = false }) {
  const inputClassName = dark ? inputDark : inputLight;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Exchange page decides /dashboard vs /setup based on whether the
        // user has accounts — no need to hardcode a `next` here.
        redirectTo: `${window.location.origin}/auth/callback/exchange`,
      },
    });
    if (error) {
      setToast({ title: "Sign in failed", description: error.message, variant: "error" });
      setIsLoading(false);
    }
    // On success, browser will redirect to Google OAuth
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setToast({ title: "Sign in failed", description: error.message, variant: "error" });
      setIsLoading(false);
    }
    // On success, UserProvider's onAuthStateChange SIGNED_IN handler takes over:
    // it checks for accounts and routes to /dashboard or /setup accordingly.
  };

  if (!isMock) {
    return <GoogleSignInButton loading={isLoading} onClick={handleGoogleSignIn} dark={dark} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label className={`text-sm font-medium ${dark ? "text-zinc-300" : "text-zinc-800"}`}>Email</label>
        <input
          className={inputClassName}
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className={`text-sm font-medium ${dark ? "text-zinc-300" : "text-zinc-800"}`}>Password</label>
        </div>
        <div className="relative">
          <input
            className={inputClassName}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        </div>
      </div>
      <Button type="submit" fullWidth disabled={isLoading} className="h-11">
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
