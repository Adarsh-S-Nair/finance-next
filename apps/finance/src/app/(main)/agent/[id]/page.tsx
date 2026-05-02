import AgentChat from "../AgentChat";

/**
 * Permalink route for a single agent conversation.
 *
 * The `key={id}` prop forces React to remount AgentChat on
 * conversation switch (e.g. drawer click goes /agent/abc → /agent/def):
 * clean state, no bleed-through of messages from the previous
 * conversation while the new one loads.
 *
 * Auth-safety lives in /api/agent/conversations/[id], which scopes by
 * user_id and returns 404 for foreign / deleted ids. AgentChat handles
 * the 404 by clearing sessionStorage and redirecting to /agent.
 */
export default async function AgentConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentChat key={id} initialConversationId={id} />;
}
