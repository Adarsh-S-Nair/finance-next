import { supabaseAdmin } from "../supabase/admin";

type MembershipRow = { household_id: string; role: string; joined_at: string; user_id?: string };
type HouseholdRow = {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};
type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type HouseholdRole = "owner" | "member";

export type HouseholdMemberPreview = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type HouseholdSummary = {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role: HouseholdRole;
  member_count: number;
  /**
   * Up to MEMBER_PREVIEW_LIMIT profiles for rendering the household's
   * avatar stack in the rail. Ordered by join date (oldest first) so
   * the creator is stable across refetches. Fewer than `member_count`
   * entries when the household has too many members to preview.
   */
  members: HouseholdMemberPreview[];
};

export const MEMBER_PREVIEW_LIMIT = 3;

export type HouseholdMember = {
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

/**
 * Curated palette used to assign each new household a distinct accent color.
 * Kept intentionally small and saturated so neighboring households are easy
 * to tell apart in the rail.
 */
export const HOUSEHOLD_COLOR_PALETTE = [
  "#e11d48",
  "#f97316",
  "#f59e0b",
  "#65a30d",
  "#16a34a",
  "#0d9488",
  "#0284c7",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#db2777",
] as const;

export function pickRandomHouseholdColor(): string {
  return HOUSEHOLD_COLOR_PALETTE[
    Math.floor(Math.random() * HOUSEHOLD_COLOR_PALETTE.length)
  ];
}

/**
 * Generate a human-friendly 8-character invite code. Avoids ambiguous
 * characters (0/O, 1/I/L) so codes can be read aloud safely.
 */
export function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Returns the caller's role in the given household, or null if they aren't a
 * member. Use this to gate household operations from API handlers.
 */
export async function getMembershipRole(
  householdId: string,
  userId: string,
): Promise<HouseholdRole | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as HouseholdRole | undefined) ?? null;
}

/**
 * Fetch every household the user is a member of, ordered by most recently
 * joined first. Includes the caller's role and the total member count.
 */
export async function listHouseholdsForUser(userId: string): Promise<HouseholdSummary[]> {
  if (!supabaseAdmin) return [];

  const { data: memberships, error: membershipErr } = await supabaseAdmin
    .from("household_members")
    .select("household_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (membershipErr) throw membershipErr;
  const membershipRows = (memberships ?? []) as MembershipRow[];
  if (membershipRows.length === 0) return [];

  const householdIds = membershipRows.map((m) => m.household_id);
  const { data: households, error: householdErr } = await supabaseAdmin
    .from("households")
    .select("id, name, color, created_by, created_at, updated_at")
    .in("id", householdIds);
  if (householdErr) throw householdErr;

  // Fetch every membership for these households in join-date order so we
  // can derive both a member count AND a stable preview slice (first N
  // joiners) in one pass. The preview powers the avatar stack in the
  // rail so we don't need a separate per-household lookup.
  const { data: memberRows, error: countErr } = await supabaseAdmin
    .from("household_members")
    .select("household_id, user_id, joined_at")
    .in("household_id", householdIds)
    .order("joined_at", { ascending: true });
  if (countErr) throw countErr;

  const counts = new Map<string, number>();
  const previewUserIds = new Map<string, string[]>();
  for (const row of (memberRows ?? []) as Array<{
    household_id: string;
    user_id: string;
    joined_at: string;
  }>) {
    counts.set(row.household_id, (counts.get(row.household_id) ?? 0) + 1);
    const preview = previewUserIds.get(row.household_id) ?? [];
    if (preview.length < MEMBER_PREVIEW_LIMIT) {
      preview.push(row.user_id);
      previewUserIds.set(row.household_id, preview);
    }
  }

  const allPreviewIds = Array.from(new Set(Array.from(previewUserIds.values()).flat()));
  const profileById = new Map<string, ProfileRow>();
  if (allPreviewIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", allPreviewIds);
    if (profilesErr) throw profilesErr;
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileById.set(p.id, p);
    }
  }

  const householdRows = (households ?? []) as HouseholdRow[];
  const householdsById = new Map<string, HouseholdRow>(householdRows.map((h) => [h.id, h]));
  return membershipRows
    .map((m) => {
      const h = householdsById.get(m.household_id);
      if (!h) return null;
      const previewIds = previewUserIds.get(h.id) ?? [];
      const members: HouseholdMemberPreview[] = previewIds.map((id) => {
        const p = profileById.get(id);
        return {
          user_id: id,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
      return {
        id: h.id,
        name: h.name,
        color: h.color,
        created_by: h.created_by,
        created_at: h.created_at,
        updated_at: h.updated_at,
        role: m.role as HouseholdRole,
        member_count: counts.get(h.id) ?? 1,
        members,
      } satisfies HouseholdSummary;
    })
    .filter((h): h is HouseholdSummary => h !== null);
}

/**
 * Fetch the member list for a household, joined with profile + auth info so
 * the UI can render names and avatars without additional lookups.
 */
export async function listHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!supabaseAdmin) return [];

  const { data: members, error: membersErr } = await supabaseAdmin
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });
  if (membersErr) throw membersErr;
  const memberRows = (members ?? []) as Array<{ user_id: string; role: string; joined_at: string }>;
  if (memberRows.length === 0) return [];

  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("user_profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", userIds);
  if (profilesErr) throw profilesErr;

  const profileRows = (profiles ?? []) as ProfileRow[];
  const profileById = new Map<string, ProfileRow>(profileRows.map((p) => [p.id, p]));

  const emailById = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (id: string) => {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        emailById.set(id, data?.user?.email ?? null);
      } catch {
        emailById.set(id, null);
      }
    }),
  );

  return memberRows.map((m) => {
    const profile = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role as HouseholdRole,
      joined_at: m.joined_at,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      email: emailById.get(m.user_id) ?? null,
    };
  });
}
