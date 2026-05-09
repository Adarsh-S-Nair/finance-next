"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import AgentChat from "./AgentChat";
import { useAgentOverlay } from "./AgentOverlayProvider";

const SESSION_KEY = "agent:lastConvId";

/**
 * Full-viewport agent overlay. Summoned via Cmd+K, the global bottom
 * input, or useAgentOverlay().open().
 *
 * Visual design: ONE frosted surface, not two. The whole viewport is
 * the chat space — there's no centered panel sitting on a blurred
 * backdrop. The user's app is still vaguely visible behind a heavy
 * frosted-glass blur, the chat content lives directly on that
 * surface, no card chrome.
 *
 * AgentChat is mounted with the user's last conversation id from
 * sessionStorage so it picks up where they left off. If the open()
 * call carried an initialMessage (bottom global input), we hand that
 * to AgentChat so it fires a first turn on mount.
 */
export default function AgentOverlay() {
  const { isOpen, close, pendingMessage, consumePendingMessage } =
    useAgentOverlay();

  const [convId, setConvId] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      setConvId(sessionStorage.getItem(SESSION_KEY));
    } catch {
      setConvId(null);
    }
    // Snapshot the pending message at open-time and clear it from
    // the provider so a later open() with no message doesn't replay
    // the previous prompt. AgentChat fires it once on mount.
    if (pendingMessage) {
      setActiveMessage(pendingMessage);
      consumePendingMessage();
    } else {
      setActiveMessage(null);
    }
  }, [isOpen, pendingMessage, consumePendingMessage]);

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
          style={{
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            backgroundColor: "color-mix(in oklab, var(--color-content-bg), transparent 12%)",
          }}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            aria-label="Close agent (Esc)"
          >
            <FiX className="h-5 w-5" />
          </button>

          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full flex flex-col"
          >
            <AgentChat
              key={isOpen ? `open-${convId ?? "new"}-${activeMessage ? "m" : "x"}` : "closed"}
              initialConversationId={convId}
              initialMessage={activeMessage}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
