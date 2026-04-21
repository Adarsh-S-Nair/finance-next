import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";
import {
  generateInviteCode,
  getMembershipRole,
} from "../../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string }> };

const INVITE_TTL_DAYS = 7;

type UserLookupRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("household_invitations")
      .select(
        "id, code, created_by, expires_at, revoked_at, used_at, used_by, dismissed_at, invited_user_id, created_at",
      )
      .eq("household_id", householdId)
      .is("revoked_at", null)
      .is("used_at", null)
      .is("dismissed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[households] list invitations error", error);
      return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
    }

    type InvitationRow = {
      id: string;
      code: string | null;
      created_by: string;
      expires_at: string;
      revoked_at: string | null;
      used_at: string | null;
      used_by: string | null;
      dismissed_at: string | null;
      invited_user_id: string | null;
      created_at: string;
    };
    const rows = (data ?? []) as InvitationRow[];
    const targetedIds = rows
      .map((r) => r.invited_user_id)
      .filter((v): v is string => !!v);
    const profiles: Record<string, UserLookupRow> = {};
    if (targetedIds.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from("user_profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", targetedIds);
      for (const p of (profileRows ?? []) as UserLookupRow[]) {
        profiles[p.id] = p;
      }
      // Emails live on auth.users; fetch them one-by-one for a small
      // pending list. Batched RPC is a future optimization.
      await Promise.all(
        targetedIds.map(async (uid: string) => {
          try {
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (profiles[uid]) {
              profiles[uid].email = authData?.user?.email ?? null;
            } else {
              profiles[uid] = {
                id: uid,
                email: authData?.user?.email ?? null,
                first_name: null,
                last_name: null,
                avatar_url: null,
              };
            }
          } catch {
            // skip — profile just won't have email
          }
        }),
      );
    }

    const invitations = rows.map((r: InvitationRow) => ({
      ...r,
      invited_user: r.invited_user_id ? profiles[r.invited_user_id] ?? null : null,
    }));

    return NextResponse.json({ invitations });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] list invitations error", error);
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}

/**
 * Owner-only. Creates an invitation.
 *
 * With no body (or `{}`): a code-based invite. Generates a random 8-char
 * code; anyone signed in can redeem it via /api/households/join.
 *
 * With `{ email }`: a targeted invite. Looks up the user by exact email,
 * stores their user_id on the invite, no code needed. The invitee sees
 * the pending invite in their notifications and has to accept it.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_TTL_DAYS);

    if (email) {
      // Targeted invite — email must match an existing account.
      if (!email.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      const { data: lookupData, error: lookupErr } = await supabaseAdmin.rpc(
        "find_user_by_email",
        { p_email: email },
      );
      if (lookupErr) {
        console.error("[households] invite lookup error", lookupErr);
        return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
      }
      const target = ((lookupData ?? []) as UserLookupRow[])[0];
      if (!target) {
        return NextResponse.json({ error: "No account matches that email" }, { status: 404 });
      }
      if (target.id === userId) {
        return NextResponse.json({ error: "You're already a member" }, { status: 400 });
      }
      const existingRole = await getMembershipRole(householdId, target.id);
      if (existingRole) {
        return NextResponse.json({ error: "That person is already a member" }, { status: 409 });
      }

      // Block duplicate pending invites to the same person.
      const { data: duplicate } = await supabaseAdmin
        .from("household_invitations")
        .select("id")
        .eq("household_id", householdId)
        .eq("invited_user_id", target.id)
        .is("used_at", null)
        .is("dismissed_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (duplicate) {
        return NextResponse.json(
          { error: "That person already has a pending invite" },
          { status: 409 },
        );
      }

      const { data, error } = await supabaseAdmin
        .from("household_invitations")
        .insert({
          household_id: householdId,
          code: null,
          invited_user_id: target.id,
          created_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select(
          "id, code, created_by, expires_at, revoked_at, used_at, used_by, dismissed_at, invited_user_id, created_at",
        )
        .single();
      if (error || !data) {
        console.error("[households] targeted invite insert error", error);
        return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
      }

      return NextResponse.json({
        invitation: {
          ...data,
          invited_user: {
            id: target.id,
            email: target.email,
            first_name: target.first_name,
            last_name: target.last_name,
            avatar_url: target.avatar_url,
          },
        },
      });
    }

    // Code invite. Retry on the (very unlikely) code collision.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const { data, error } = await supabaseAdmin
        .from("household_invitations")
        .insert({
          household_id: householdId,
          code,
          created_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select(
          "id, code, created_by, expires_at, revoked_at, used_at, used_by, dismissed_at, invited_user_id, created_at",
        )
        .single();
      if (!error && data) {
        return NextResponse.json({ invitation: data });
      }
      lastError = error;
      if (error?.code !== "23505") break;
    }

    console.error("[households] create invitation error", lastError);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] create invitation error", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
