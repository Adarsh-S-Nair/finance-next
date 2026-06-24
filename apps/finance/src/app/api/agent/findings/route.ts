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
  // swept. Resolved findings are kept (soft-resolve), so the most recent
  // updated_at across all of this user's findings — any status — is a
  // faithful proxy for the last sweep that touched anything. Null for a
  // user the sweep has never produced a finding for.
  const { data: lastRow, error: lastError } = await supabaseAdmin
    .from("agent_findings")
    .select("updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) throw lastError;

  return Response.json({
    findings: findings ?? [],
    lastCheckedAt: lastRow?.updated_at ?? null,
  });
});
