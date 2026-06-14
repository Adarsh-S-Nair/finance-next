import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@zervo/supabase";

/**
 * The agent-action ledger: the audit + undo trail for every write the
 * assistant makes autonomously on a user's behalf.
 *
 * Two operations, both deliberately generic so a new autonomous action
 * type needs no new ledger code:
 *  - `recordAgentAction` writes one ledger row (provenance + the before/
 *    after state) — the row the digest reads and undo reverses.
 *  - `revertAgentAction` replays a row's `previous_state` back onto its
 *    subject and flips the row to 'reverted'.
 *
 * Proposals (rules, budget changes) live in `agent_findings`; this is
 * strictly things the agent *did*.
 */

export type AgentActionStatus = "shadow" | "applied" | "reverted";

export interface RecordActionInput {
  userId: string;
  /** What the agent did, e.g. 'categorize_transaction'. */
  actionType: string;
  /** 'applied' writes for real; 'shadow' records a dry run (calibration). */
  status?: Extract<AgentActionStatus, "applied" | "shadow">;
  /** The row touched, addressed generically so undo works for any type. */
  subjectTable: string;
  subjectId: string;
  /** Field values before the change — what a revert restores. */
  previousState?: Record<string, unknown>;
  /** Field values the action set. */
  newState?: Record<string, unknown>;
  /** Human-readable justification for the digest/undo UI. */
  reason?: string;
  /** 0..1 confidence behind the decision (calibration + thresholding). */
  confidence?: number;
  /** Where the action originated, e.g. 'cron-sweep'. */
  source?: string;
}

/** Insert one ledger row. Returns the new action's id. */
export async function recordAgentAction(
  admin: SupabaseClient<Database>,
  input: RecordActionInput,
): Promise<string> {
  const { data, error } = await admin
    .from("agent_actions")
    .insert({
      user_id: input.userId,
      action_type: input.actionType,
      status: input.status ?? "applied",
      subject_table: input.subjectTable,
      subject_id: input.subjectId,
      previous_state: (input.previousState ?? {}) as Json,
      new_state: (input.newState ?? {}) as Json,
      reason: input.reason ?? null,
      confidence: input.confidence ?? null,
      source: input.source ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export interface RevertResult {
  reverted: boolean;
  /** Why a revert was a no-op, when `reverted` is false. */
  reason?: "not_found" | "not_applied";
}

/**
 * Reverse one applied action: write its `previous_state` back onto the
 * subject row and mark the ledger entry 'reverted'. Idempotent — a row
 * that's already reverted (or never applied) is a no-op, not an error.
 *
 * Scoped to `userId` so a stale/forged action id can't revert another
 * user's data even though the admin client bypasses RLS.
 */
export async function revertAgentAction(
  admin: SupabaseClient<Database>,
  userId: string,
  actionId: string,
): Promise<RevertResult> {
  const { data: action, error } = await admin
    .from("agent_actions")
    .select("id, status, subject_table, subject_id, previous_state")
    .eq("id", actionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!action) return { reverted: false, reason: "not_found" };
  if (action.status !== "applied") return { reverted: false, reason: "not_applied" };

  // Restore the prior field values on the subject row. The table name is
  // dynamic, so we drop to the untyped client here — the column set is
  // whatever was captured in previous_state at record time.
  const untyped = admin as unknown as SupabaseClient;
  const { error: restoreError } = await untyped
    .from(action.subject_table)
    .update(action.previous_state as Record<string, unknown>)
    .eq("id", action.subject_id);
  if (restoreError) throw restoreError;

  const { error: markError } = await admin
    .from("agent_actions")
    .update({ status: "reverted", reverted_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("user_id", userId);
  if (markError) throw markError;

  return { reverted: true };
}
