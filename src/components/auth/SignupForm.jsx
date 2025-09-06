"use client";

import { useState } from "react";
import Button from "../../components/Button";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../components/ToastProvider";
import { useRouter } from "next/navigation";
import { upsertUserProfile, buildAvatarUrl } from "../../lib/userProfile";
import { useUser } from "../../components/UserProvider";

export default function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setToast } = useToast();
  const router = useRouter();
  const { user, profile } = useUser();

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
        <div className="field">
          <label className="text-sm text-[var(--color-muted)]">First name</label>
          <input
            className="input"
            type="text"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="text-sm text-[var(--color-muted)]">Last name</label>
          <input
            className="input"
            type="text"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label className="text-sm text-[var(--color-muted)]">Email</label>
        <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label className="text-sm text-[var(--color-muted)]">Password</label>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Creating account..." : "Create account"}</Button>
    </form>
  );
}
