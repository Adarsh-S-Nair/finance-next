"use client";

import { useState } from "react";
import Button from "../../components/Button";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="field">
        <label className="text-sm text-[var(--color-muted)]">Email</label>
        <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label className="text-sm text-[var(--color-muted)]">Password</label>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Signing in..." : "Sign in"}</Button>
    </form>
  );
}


