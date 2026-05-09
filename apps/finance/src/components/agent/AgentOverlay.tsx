"use client";

import { useEffect, useRef, useState } from "react";
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

  // Mirror pending state into refs. The snapshot effect below only
  // re-runs on isOpen / consumePending changes — listing the pending
  // values as deps caused a nasty bug where consumePending() flushed
  // them to undefined, the effect re-ran, and the sessionStorage
  // fallback branch reinstated the previous conversation id, undoing
  // the fresh-chat override the bottom input had just set.
  const pendingMessageRef = useRef(pendingMessage);
  const pendingConversationIdRef = useRef(pendingConversationId);
  useEffect(() => {
    pendingMessageRef.current = pendingMessage;
    pendingConversationIdRef.current = pendingConversationId;
  });

  useEffect(() => {
    if (!isOpen) return;
    // Snapshot the pending state from refs (captured at the moment
    // open() was called), then immediately drain it so the next bare
    // open() doesn't replay this turn's prompt or override.
    const pcid = pendingConversationIdRef.current;
    const pmsg = pendingMessageRef.current;
    let resolved: string | null;
    if (pcid !== undefined) {
      resolved = pcid; // explicit override (null forces fresh)
    } else {
      try {
        resolved = sessionStorage.getItem(SESSION_KEY);
      } catch {
        resolved = null;
      }
    }
    setConvId(resolved);
    setActiveMessage(pmsg ?? null);
    consumePending();
  }, [isOpen, consumePending]);

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
