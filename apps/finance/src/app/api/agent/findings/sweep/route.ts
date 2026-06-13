import { withAuth } from "../../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { runFindingsForUser } from "../../../../../lib/agent/findings/run";

/**
 * POST /api/agent/findings/sweep
 *
 * Runs the findings detectors for the authenticated user, upserts what
 * they surface, and returns the user's current active findings. This is
 * the on-demand trigger; a scheduled job will run the same
 * `runFindingsForUser` across all users nightly.
 */
export const POST = withAuth("agent:findings:sweep", async (_request, userId) => {
  const { drafts } = await runFindingsForUser(userId, supabaseAdmin);

  const { data: findings, error } = await supabaseAdmin
    .from("agent_findings")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["new", "seen"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Response.json({ detected: drafts.length, findings: findings ?? [] });
});
