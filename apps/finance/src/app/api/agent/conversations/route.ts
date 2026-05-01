import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

/**
 * Returns the user's conversations sorted by most-recently-active first.
 * No messages — just thread metadata for the switcher dropdown.
 */
export const GET = withAuth("agent:conversations:list", async (_req: NextRequest, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("user_agent_conversations")
    .select("id, title, last_message_at, created_at")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[agent:conversations:list]", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
});
