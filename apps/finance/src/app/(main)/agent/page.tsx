"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AgentChat from "./AgentChat";

const SESSION_KEY = "agent:lastConvId";

/**
 * Agent welcome route. Always starts at the fresh welcome screen
 * UNLESS this tab session already has a conversation it was viewing —
 * in which case we transparently redirect to /agent/[id] so the user
 * picks up where they left off.
 *
 * The "this tab session" gate is what fixes the cross-device weirdness:
 * - sessionStorage is per-tab, per-origin
 * - signing in on a new device → empty session → welcome screen
 * - opening a new tab on the same device → empty session → welcome screen
 * - navigating away to /transactions and back → session preserved → resume
 * - refresh while in a conversation → URL is /agent/[id] (set via the
 *   History API on first message) → routes through the [id] page directly
 *
 * Auth-safety: if sessionStorage has a stale id (deleted conversation,
 * different user), the [id] page's API call returns 404 and AgentChat
 * clears sessionStorage + redirects back to /agent. No data leaks.
 */
export default function AgentWelcomePage() {
  const router = useRouter();
  // Until we've checked sessionStorage we don't know whether to render
  // the welcome screen or redirect. Render null in the interim to avoid
  // a brief flash of welcome content before the redirect fires.
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    let lastId: string | null = null;
    try {
      lastId = sessionStorage.getItem(SESSION_KEY);
    } catch {
      // sessionStorage may be disabled (private mode). Treat as empty.
    }
    if (lastId) {
      router.replace(`/agent/${lastId}`);
      // Don't decide — we're navigating away. Keep rendering null
      // until the new route mounts.
    } else {
      setDecided(true);
    }
  }, [router]);

  if (!decided) return null;
  return <AgentChat initialConversationId={null} />;
}
