import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

/**
 * Fetch a specific conversation + its full message log. Same shape as
 * /api/agent/conversation (the "latest" endpoint) so the chat UI can
 * swap data sources interchangeably. 404s if the conversation belongs
 * to another user.
 */
export const GET = withAuth<{ id: string }>(
  "agent:conversations:get",
  async (_req: NextRequest, userId: string, { params }) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const { data: conversation } = await supabaseAdmin
      .from("user_agent_conversations")
      .select("id, title, summary, last_message_at, created_at, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!conversation || conversation.user_id !== userId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { data: messages } = await supabaseAdmin
      .from("user_agent_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        summary: conversation.summary,
        last_message_at: conversation.last_message_at,
        created_at: conversation.created_at,
      },
      messages: messages ?? [],
    });
  },
);

export const DELETE = withAuth<{ id: string }>(
  "agent:conversations:delete",
  async (_req: NextRequest, userId: string, { params }) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    // Confirm ownership before deleting (RLS would block, but the
    // service-role admin client bypasses RLS — so check here).
    const { data: conversation } = await supabaseAdmin
      .from("user_agent_conversations")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!conversation || conversation.user_id !== userId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("user_agent_conversations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[agent:conversations:delete]", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  },
);
