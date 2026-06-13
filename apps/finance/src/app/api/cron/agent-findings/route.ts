import { NextRequest } from "next/server";
import { verifyCronSecret } from "../../../../lib/api/cron";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { getAdminUserIds } from "../../../../lib/api/admin";
import { runFindingsForUser } from "../../../../lib/agent/findings/run";

/**
 * GET /api/cron/agent-findings
 *
 * Nightly findings sweep. Runs the detector pipeline for each user and
 * upserts what it surfaces.
 *
 * Deliberately gated to ADMIN_EMAILS only for now — the feature isn't
 * ready for everyone, and there's no reason to sweep the whole user base
 * while it's still being built. Widening to all users later is a one-line
 * change (swap getAdminUserIds for a full user query).
 *
 * Authenticated by CRON_SECRET; scheduled from vercel.json.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const userIds = await getAdminUserIds();

  const results: Array<{ userId: string; detected?: number; error?: string }> = [];
  for (const userId of userIds) {
    try {
      const { drafts } = await runFindingsForUser(userId, supabaseAdmin);
      results.push({ userId, detected: drafts.length });
    } catch (e) {
      results.push({ userId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ ran: userIds.length, results });
}
