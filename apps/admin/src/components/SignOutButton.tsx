"use client";

import { useState } from "react";
import { Button } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <Button variant="outline" onClick={handleSignOut} loading={loading}>
      Sign out
    </Button>
  );
}
