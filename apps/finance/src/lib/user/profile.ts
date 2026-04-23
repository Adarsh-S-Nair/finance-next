"use client";

import { supabase } from "../supabase/client";
import type { Tables } from "../../types/database";

type UserProfileRow = Pick<
  Tables<'user_profiles'>,
  | 'id'
  | 'theme'
  | 'accent_color'
  | 'avatar_url'
  | 'first_name'
  | 'last_name'
  | 'onboarding_step'
  | 'subscription_tier'
  | 'monthly_income'
>;

export async function getCurrentUserId(): Promise<string | null> {
  // Try getSession with a tight timeout — it can deadlock due to Supabase's internal lock
  try {
    const result = (await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
    ])) as { data?: { session?: { user?: { id?: string } | null } | null } | null };
    const sessionId = result?.data?.session?.user?.id ?? null;
    if (sessionId) return sessionId;
  } catch (sessErr) {
    console.log("[userProfile] getSession error", sessErr);
  }
  return null;
}

async function resolveUserIdWithRefresh(): Promise<string | null> {
  // Try getUser quickly
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (err) {
    const e = err as { message?: string };
    console.warn("[userProfile] getUser (initial) failed", e?.message ?? err);
  }
  // Attempt refreshSession (handles expired tokens on tab return)
  try {
    const refreshRes = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("refreshSession timeout") }),
          1500
        )
      ),
    ]);
    console.log("[userProfile] refreshSession result", refreshRes);
  } catch (e) {
    console.log("[userProfile] refreshSession error", e);
  }
  // Re-check user, then session
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (err) {
    const e = err as { message?: string };
    console.warn("[userProfile] getUser (post-refresh) failed", e?.message ?? err);
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch (err) {
    const e = err as { message?: string };
    console.warn("[userProfile] getSession (fallback) failed", e?.message ?? err);
    return null;
  }
}

export async function fetchUserProfile(): Promise<{
  userId: string | null;
  profile: UserProfileRow | null;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { userId: null, profile: null };
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, theme, accent_color, avatar_url, first_name, last_name, onboarding_step, subscription_tier, monthly_income"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) return { userId, profile: null };
  return { userId, profile: data as UserProfileRow | null };
}

export async function upsertUserProfile(
  partial: Partial<Tables<'user_profiles'>>
): Promise<{ data: unknown; error: Error | null }> {
  console.log("[userProfile] upsert start", partial);
  // Prefer direct user fetch; avoid potentially hanging getSession in background tabs
  let userId: string | null = null;
  try {
    const userRes = (await Promise.race([
      supabase.auth.getUser(),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("getUser timeout") }),
          1000
        )
      ),
    ])) as { data?: { user?: { id?: string } | null } | null };
    userId = userRes?.data?.user?.id ?? null;
  } catch (err) {
    const e = err as { message?: string };
    console.warn("[userProfile] getUser race failed", e?.message ?? err);
  }
  if (!userId) {
    userId = await resolveUserIdWithRefresh();
  }
  console.log("[userProfile] resolved userId", { userId });
  if (!userId) {
    // Final attempt: trigger sign-in state propagation by re-emitting current session
    try {
      await supabase.auth.getSession();
    } catch (err) {
      const e = err as { message?: string };
      console.warn("[userProfile] final getSession attempt failed", e?.message ?? err);
    }
  }
  if (!userId) return { error: new Error("Not authenticated"), data: null };
  const payload = { id: userId, ...partial };
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error) console.log("[userProfile] upsert error", error);
  else console.log("[userProfile] upsert ok", data);
  return { data, error: (error as Error | null) ?? null };
}

export function buildAvatarUrl(userId?: string | null, email?: string | null): string {
  // Prefer deterministic unique ID; fall back to email hash-like behavior via URL params
  if (userId)
    return `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(userId)}&size=256&backgroundType=gradientLinear`;
  if (email)
    return `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(email.trim().toLowerCase())}&size=256&backgroundType=gradientLinear`;
  return `https://api.dicebear.com/8.x/identicon/svg?seed=anon&size=256&backgroundType=gradientLinear`;
}
