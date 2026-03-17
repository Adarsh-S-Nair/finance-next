"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase/client";
import { useToast } from "../../components/providers/ToastProvider";
import { upsertUserProfile, buildAvatarUrl } from "../../lib/user/profile";

const inputClassName =
  "flex h-11 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50";

export default function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      setToast({ title: "Sign up failed", description: error.message, variant: "error" });
    } else if (data?.user) {
      try {
        const avatarUrl = buildAvatarUrl(data.user.id, data.user.email);
        await upsertUserProfile({ avatar_url: avatarUrl });
      } catch {}
      setToast({ title: "Account created", variant: "success" });
      router.push("/dashboard");
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-800">First name</label>
          <input className={inputClassName} type="text" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-800">Last name</label>
          <input className={inputClassName} type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-800">Email</label>
        <input className={inputClassName} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-800">Password</label>
        <input className={inputClassName} type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" fullWidth disabled={isLoading} className="h-11">
        {isLoading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
