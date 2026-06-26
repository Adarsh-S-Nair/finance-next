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

  // For the empty-state "Checked …" line we want when the assistant last
  // swept. The sweep stamps `agent_last_swept_at` every run regardless of
  // whether any finding changed, so it's the faithful signal. Fall back to
  // the most recent finding's updated_at for users swept before this column
  // existed (it lags on quiet nights, but it's better than nothing).
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("agent_last_swept_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  let lastCheckedAt = profile?.agent_last_swept_at ?? null;
  if (!lastCheckedAt) {
    const { data: lastRow, error: lastError } = await supabaseAdmin
      .from("agent_findings")
      .select("updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    lastCheckedAt = lastRow?.updated_at ?? null;
  }

  return Response.json({
    findings: findings ?? [],
    lastCheckedAt,
  });
});
