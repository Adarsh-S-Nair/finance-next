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
 * AgentChat receives the resolved conversation id + initial message
 * once on each open. Cmd+K and the bottom global input force fresh
 * via `conversationId: null`; the bottom input's recent panel passes
 * a specific id; an unspecified call falls back to the last thread
 * stored in sessionStorage so explicit "resume last" callers still
 * work.
 */
export default function AgentOverlay() {
  const {
    isOpen,
    close,
    pendingMessage,
    pendingConversationId,
    consumePending,
  } = useAgentOverlay();

  const [convId, setConvId] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Resolve the conversation to load: explicit override wins; else
    // fall back to the last-viewed conversation in sessionStorage so
    // legacy bare-open() callers still resume.
    let resolved: string | null;
    if (pendingConversationId !== undefined) {
      resolved = pendingConversationId; // null → fresh; string → specific
    } else {
      try {
        resolved = sessionStorage.getItem(SESSION_KEY);
      } catch {
        resolved = null;
      }
    }
    setConvId(resolved);
    setActiveMessage(pendingMessage ?? null);
    // Drain pending state so a later bare open() doesn't replay this
    // turn's prompt or override.
    consumePending();
  }, [isOpen, pendingMessage, pendingConversationId, consumePending]);

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
