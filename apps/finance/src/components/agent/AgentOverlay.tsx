"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import AgentChat from "../../app/(main)/agent/AgentChat";
import { useAgentOverlay } from "./AgentOverlayProvider";

const SESSION_KEY = "agent:lastConvId";

/**
 * Full-viewport agent overlay. Summoned via Cmd+K, the topbar button,
 * or useAgentOverlay().open().
 *
 * Visual design: ONE frosted surface, not two. The whole viewport is
 * the chat space — there's no centered panel sitting on a blurred
 * backdrop. The user's app is still vaguely visible behind a heavy
 * frosted-glass blur, the chat content lives directly on that
 * surface, no card chrome.
 *
 * The chat input has its own surface-alt pill (defined inside
 * AgentChat) which provides the only soft visual anchor we need —
 * messages are just text + widgets on the frosted ground.
 *
 * AgentChat is mounted with the user's last conversation id from
 * sessionStorage so it picks up where they left off — same source of
 * truth as /agent. Each open remounts so we get fresh DB state.
 */
export default function AgentOverlay() {
  const { isOpen, close } = useAgentOverlay();

  // Read the last conversation id when the overlay opens. We re-read
  // every time so a conversation started elsewhere (e.g. /agent page)
  // is picked up here, and vice versa.
  const [convId, setConvId] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    try {
      setConvId(sessionStorage.getItem(SESSION_KEY));
    } catch {
      setConvId(null);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          // The whole overlay is one frosted surface. Translucent fill
          // + heavy backdrop blur means the user's app peeks through
          // very subtly — enough to feel like the agent is OVER their
          // content, not a portal into a different app. No shadow, no
          // border, no panel inside. One layer.
          style={{
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            backgroundColor: "color-mix(in oklab, var(--color-content-bg), transparent 12%)",
          }}
        >
          {/* Close button — top-right, floats over the chat content. */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            aria-label="Close agent (Esc)"
          >
            <FiX className="h-5 w-5" />
          </button>

          {/* Content column — same max-width as /agent, centered.
              AgentChat renders its own scrollable message list and
              sticky input; we just give it the shape it expects. */}
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full flex flex-col"
          >
            <AgentChat
              key={isOpen ? `open-${convId ?? "new"}` : "closed"}
              initialConversationId={convId}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
