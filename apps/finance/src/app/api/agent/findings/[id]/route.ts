import { withAuth } from "../../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const ALLOWED_STATUSES = ["new", "seen", "acted", "dismissed"] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

/**
 * PATCH /api/agent/findings/:id
 *
 * Update a finding's status (seen / acted / dismissed). Scoped to the
 * caller's own findings — the service-role client bypasses RLS, so
 * ownership is enforced by matching user_id in the query.
 */
export const PATCH = withAuth<{ id: string }>(
  "agent:findings:update",
  async (request, userId, { params }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status as Status | undefined;

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }

    const patch: { status: Status; resolved_at?: string | null } = { status };
    patch.resolved_at = status === "dismissed" || status === "acted" ? new Date().toISOString() : null;

    const { data, error } = await supabaseAdmin
      .from("agent_findings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return Response.json({ error: "not found" }, { status: 404 });

    return Response.json({ finding: data });
  },
);
