"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import AgentChat from "../../app/(main)/agent/AgentChat";
import { useAgentOverlay } from "./AgentOverlayProvider";

const SESSION_KEY = "agent:lastConvId";

/**
 * Full-viewport agent overlay. Renders fixed above the rest of the app
 * with a blurred backdrop, summoned via Cmd+K, the topbar button, or
 * useAgentOverlay().open().
 *
 * Layout:
 * - backdrop: blurred + slightly dimmed underlying app, click to close
 * - panel: centered chat content, max-width matching /agent
 * - close button: top-right
 *
 * AgentChat is mounted with the user's last conversation id from
 * sessionStorage so they pick up where they left off — same source of
 * truth the /agent route uses, so the overlay and the dedicated page
 * stay consistent.
 *
 * Each open/close cycle remounts AgentChat. State (in-flight stream,
 * optimistic message) doesn't persist across closes — that's fine
 * because everything's persisted to the DB on the server side, and
 * remounting reads the latest from the DB. The cost is one extra fetch
 * per open, which is cheap.
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
        >
          {/* Backdrop — blur + dim. Click closes the overlay (standard
              modal behavior). */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={close}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            aria-hidden
          />

          {/* Panel container — full viewport, scrollable, click-through
              to backdrop on margins so closing on background works
              even when the chat is short. */}
          <div className="relative h-full flex flex-col items-center pointer-events-none">
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative pointer-events-auto h-full w-full max-w-[860px] bg-[var(--color-content-bg)] flex flex-col"
              // Soft shadow + subtle border so the panel reads as a
              // distinct surface above the blurred app behind it.
              style={{
                boxShadow:
                  "0 24px 80px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Close button — top-right, floating over the chat
                  content. Sized + colored to match the rest of the
                  topbar buttons in the app. */}
              <button
                type="button"
                onClick={close}
                className="absolute top-3 right-3 z-10 p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                aria-label="Close agent (Esc)"
              >
                <FiX className="h-5 w-5" />
              </button>

              {/* AgentChat manages its own internal layout (sticky
                  input, scroll, etc) and expects to fill the
                  container. The flex parent above + h-full here gives
                  it the same shape as a dedicated route would. Key
                  rotation forces a clean remount each open so we get
                  fresh DB state. */}
              <div className="flex-1 min-h-0 flex flex-col">
                <AgentChat
                  key={isOpen ? `open-${convId ?? "new"}` : "closed"}
                  initialConversationId={convId}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
