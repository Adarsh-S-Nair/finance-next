"use client";

import { useState } from "react";
import { Button } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";

const ZERVO_APP_URL =
  process.env.NEXT_PUBLIC_ZERVO_APP_URL ?? "https://www.zervo.app";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Bounce back to the main app — admin no longer has its own auth
    // page, so /auth here is gone.
    window.location.href = ZERVO_APP_URL;
  }

  return (
    <Button variant="outline" onClick={handleSignOut} loading={loading}>
      Sign out
    </Button>
  );
}
