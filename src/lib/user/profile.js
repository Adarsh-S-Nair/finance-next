"use client";

import { supabase } from "../supabase/client";

export async function getCurrentUserId() {
  // Try getSession with a tight timeout — it can deadlock due to Supabase's internal lock
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
    ]);
    const sessionId = result?.data?.session?.user?.id ?? null;
    if (sessionId) return sessionId;
  } catch (sessErr) {
    console.log("[userProfile] getSession error", sessErr);
  }
  return null;
}

async function resolveUserIdWithRefresh() {
  // Try getUser quickly
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (err) {
    console.warn("[userProfile] getUser (initial) failed", err?.message ?? err);
  }
  // Attempt refreshSession (handles expired tokens on tab return)
  try {
    const refreshRes = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("refreshSession timeout") }), 1500)),
    ]);
    // @ts-ignore
    console.log("[userProfile] refreshSession result", refreshRes);
  } catch (e) {
    console.log("[userProfile] refreshSession error", e);
  }
  // Re-check user, then session
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (err) {
    console.warn("[userProfile] getUser (post-refresh) failed", err?.message ?? err);
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch (err) {
    console.warn("[userProfile] getSession (fallback) failed", err?.message ?? err);
    return null;
  }
}

export async function fetchUserProfile() {
  const userId = await getCurrentUserId();
  if (!userId) return { userId: null, profile: null };
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, theme, accent_color, avatar_url, first_name, last_name, onboarding_step, subscription_tier, monthly_income")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { userId, profile: null };
  return { userId, profile: data };
}

export async function upsertUserProfile(partial) {
  console.log("[userProfile] upsert start", partial);
  // Prefer direct user fetch; avoid potentially hanging getSession in background tabs
  let userId = null;
  try {
    const userRes = await Promise.race([
      supabase.auth.getUser(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("getUser timeout") }), 1000)),
    ]);
    // @ts-ignore
    userId = userRes?.data?.user?.id ?? null;
  } catch (err) {
    console.warn("[userProfile] getUser race failed", err?.message ?? err);
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
      console.warn("[userProfile] final getSession attempt failed", err?.message ?? err);
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
  return { data, error };
}

export function buildAvatarUrl(userId, email) {
  // Prefer deterministic unique ID; fall back to email hash-like behavior via URL params
  // Using dicebear for simplicity and cacheability
  if (userId) return `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(userId)}&size=256&backgroundType=gradientLinear`;
  if (email) return `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(email.trim().toLowerCase())}&size=256&backgroundType=gradientLinear`;
  return `https://api.dicebear.com/8.x/identicon/svg?seed=anon&size=256&backgroundType=gradientLinear`;
}


