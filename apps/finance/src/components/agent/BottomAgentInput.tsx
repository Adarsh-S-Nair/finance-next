"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiClock } from "react-icons/fi";
import { authFetch } from "../../lib/api/fetch";
import { useAgentOverlay } from "./AgentOverlayProvider";

const SESSION_KEY = "agent:lastConvId";

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
};

/**
 * Persistent bottom-of-viewport input for summoning the agent from
 * anywhere in the app. Default state: a flat resting pill at the
 * bottom. Focused state: lifts toward mid-screen with a soft shadow
 * and reveals recent conversations above — a "ready to chat" cue.
 *
 * Submitting opens the overlay with the message pre-fired; clicking a
 * recent conversation opens the overlay scoped to that thread. Hidden
 * while the overlay itself is open — the overlay has its own input.
 */
export default function BottomAgentInput() {
  const { isOpen, open } = useAgentOverlay();
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the conversation list the first time the user expands.
  // Page-load cost stays zero for users who never use the agent.
  useEffect(() => {
    if (!expanded || loadedOnce) return;
    setLoadedOnce(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/agent/conversations");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (!cancelled) setConversations(body.conversations ?? []);
      } catch {
        // Silent — input still works without history visible.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, loadedOnce]);

  // Click outside collapses. We watch mousedown so the recent-list
  // button onMouseDown handlers can `preventDefault` to keep input
  // focus through the click.
  useEffect(() => {
    if (!expanded) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setExpanded(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [expanded]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    open({ initialMessage: trimmed });
    setValue("");
    setExpanded(false);
  }

  function openConversation(id: string) {
    // The overlay reads the active conversation from sessionStorage on
    // mount, so writing here + open() is enough to scope it.
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch {
      // private mode — fall back to a fresh chat.
    }
    open();
    setExpanded(false);
    setValue("");
  }

  const hasText = value.trim().length > 0;
  const visibleConversations = conversations.slice(0, 6);

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          key="bottom-agent-input"
          ref={containerRef}
          className="fixed inset-x-0 bottom-0 z-30 pointer-events-none flex justify-center pb-3 md:pb-5 md:pl-20"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: expanded ? "-32vh" : 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
        >
          <div className="pointer-events-auto w-full max-w-[640px] mx-3 md:mx-4 flex flex-col">
            <AnimatePresence>
              {expanded && visibleConversations.length > 0 && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-3"
                >
                  <div className="rounded-3xl bg-[var(--color-surface)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)] p-2">
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                      Recent
                    </div>
                    <div className="max-h-[36vh] overflow-y-auto">
                      {visibleConversations.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            // Stop the click-outside / blur path so the
                            // following click event still fires.
                            e.preventDefault();
                          }}
                          onClick={() => openConversation(c.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/70 transition-colors"
                        >
                          <FiClock className="h-3.5 w-3.5 text-[var(--color-muted)] shrink-0" />
                          <span className="truncate">
                            {c.title?.trim() || "Untitled"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <motion.div
                animate={{
                  scale: expanded ? 1.015 : 1,
                  boxShadow: expanded
                    ? "0 30px 80px -28px rgba(0,0,0,0.55), 0 6px 20px -10px rgba(0,0,0,0.25)"
                    : "0 14px 32px -18px rgba(0,0,0,0.35), 0 2px 6px -3px rgba(0,0,0,0.18)",
                }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="relative flex items-center rounded-full bg-[var(--color-surface)]"
              >
                <span
                  aria-hidden
                  className="ml-3.5 h-6 w-6 shrink-0 bg-[var(--color-fg)]"
                  style={{
                    WebkitMaskImage: "url(/logo.svg)",
                    maskImage: "url(/logo.svg)",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={() => setExpanded(true)}
                  placeholder="Ask Zervo anything…"
                  aria-label="Ask the agent"
                  className="flex-1 bg-transparent py-3 pl-2.5 pr-12 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
                />
                <AnimatePresence>
                  {hasText && (
                    <motion.button
                      key="send"
                      type="submit"
                      aria-label="Send to agent"
                      initial={{ opacity: 0, scale: 0.85, y: "-50%" }}
                      animate={{ opacity: 1, scale: 1, y: "-50%" }}
                      exit={{
                        opacity: 0,
                        scale: 0.85,
                        y: "-50%",
                        transition: { type: "tween", duration: 0.1, ease: "easeOut" },
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      className="absolute right-2 top-1/2 inline-flex items-center justify-center h-8 w-8 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] shadow-sm cursor-pointer"
                    >
                      <FiArrowUp className="h-4 w-4" strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
