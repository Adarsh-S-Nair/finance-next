"use client";

import { useState } from "react";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";
import { FiEye, FiEyeOff } from "react-icons/fi";

const inputLight =
  "flex h-11 w-full rounded-lg border-0 bg-zinc-200/50 px-4 py-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-transparent focus:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50";

const inputDark =
  "flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-white/20 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const isMock = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

// Google "G" logo SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

function GoogleSignInButton({ loading, onClick, label = "Sign in with Google", dark = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex h-11 w-full items-center justify-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        dark
          ? "bg-white/10 text-white hover:bg-white/15"
          : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200/70"
      }`}
    >
      <GoogleIcon />
      {loading ? "Redirecting…" : label}
    </button>
  );
}

export { GoogleSignInButton, GoogleIcon };

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
        redirectTo: `${window.location.origin}/auth/callback/exchange?next=/setup`,
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
