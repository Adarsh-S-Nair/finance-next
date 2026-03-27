"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";
import { upsertUserProfile, buildAvatarUrl } from "../../lib/user/profile";
import { FiEye, FiEyeOff } from "react-icons/fi";

const inputClassName =
  "flex h-11 w-full rounded-lg border-0 bg-zinc-200/50 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all outline-none focus:bg-zinc-200/60 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setToast({ title: "Sign up failed", description: error.message, variant: "error" });
    } else if (data?.user) {
      try {
        const avatarUrl = buildAvatarUrl(data.user.id, data.user.email);
        await upsertUserProfile({ avatar_url: avatarUrl });
      } catch {}
      setToast({ title: "Account created", variant: "success" });
      router.push("/setup");
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-800">Email</label>
        <input className={inputClassName} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-800">Password</label>
        <div className="relative">
          <input className={inputClassName} type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
        {isLoading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
