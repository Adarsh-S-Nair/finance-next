import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

/**
 * GET /api/agent/findings
 *
 * The authenticated user's active findings (new + seen), newest first —
 * what the dashboard assistant card and /today render.
 */
export const GET = withAuth("agent:findings:list", async (_request, userId) => {
  const { data: findings, error } = await supabaseAdmin
    .from("agent_findings")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["new", "seen"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Response.json({ findings: findings ?? [] });
});
