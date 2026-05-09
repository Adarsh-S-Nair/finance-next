"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiClock, FiTrash2 } from "react-icons/fi";
import { ConfirmOverlay, Drawer } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import { useAgentOverlay } from "./AgentOverlayProvider";

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
};

function formatRelative(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  const diffMin = Math.floor((now - ts) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Persistent bottom-of-viewport input for summoning the agent from
 * anywhere in the app. Default state: a flat resting pill at the
 * bottom. Focused state: lifts to the vertical center, reveals a
 * Recent panel above it for one-tap resume of the most recent
 * conversations, and surfaces a top-left history button that opens a
 * drawer with the full conversation list. Submitting opens the
 * overlay with the message pre-fired.
 *
 * Hidden while the overlay itself is open — the overlay has its own
 * input and history affordances.
 */
export default function BottomAgentInput() {
  const { isOpen, open } = useAgentOverlay();
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Translate-Y in pixels needed to land the input pill at the
  // vertical center of the viewport. Recomputed on resize so it
  // stays accurate across orientation / window changes. SSR-safe:
  // starts at 0 (bottom-anchored), populated on mount.
  const [centerOffsetPx, setCenterOffsetPx] = useState(0);
  // Single timestamp captured on mount so the drawer rows don't
  // re-render their relative-time labels every tick. Good enough for
  // the bottom input; if a user keeps the drawer open for hours the
  // numbers go stale but reopen refreshes them.
  const [nowAtMount, setNowAtMount] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setNowAtMount(Date.now()), []);

  useEffect(() => {
    function recompute() {
      // Container is bottom-anchored with ~20px of padding-bottom.
      // The input pill is ~56px tall. Half of that + the padding is
      // the distance from viewport bottom to the input's center.
      // Subtract that from half the viewport to get the translation.
      const PILL_HALF = 28;
      const PADDING_BOTTOM = 20;
      const vh = window.innerHeight;
      setCenterOffsetPx(-(vh / 2 - PILL_HALF - PADDING_BOTTOM));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  // Lazy-load the conversation list. We fire on first expand AND on
  // every drawer open: first expand keeps page-load cost at zero for
  // users who never touch the agent; the drawer open path is a refresh
  // so a thread the user just had in the overlay shows up here without
  // a full page reload, and recovers from a previous failed fetch.
  useEffect(() => {
    if (!expanded && !drawerOpen) return;
    if (loadedOnce && !drawerOpen) return;
    setLoadedOnce(true);
    setLoadingConversations(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/agent/conversations");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (!cancelled) setConversations(body.conversations ?? []);
      } catch {
        // Silent — input still works without history visible.
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, drawerOpen, loadedOnce]);

  // Click outside collapses. Paused while the drawer is open — the
  // drawer renders via portal at body level, so its clicks count as
  // "outside" the input container; without the pause, scrolling /
  // mis-clicking inside the drawer would yank the focused state away
  // and snap the pill back to the bottom.
  useEffect(() => {
    if (!expanded || drawerOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setExpanded(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [expanded, drawerOpen]);

  // Esc collapses the focused state. Gated on `!drawerOpen` so when
  // both are up Esc closes the drawer first (its own listener handles
  // that) and a second Esc collapses the input — same one-thing-at-a-
  // time pattern as a stack of modals.
  useEffect(() => {
    if (!expanded || drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setExpanded(false);
      setValue("");
      inputRef.current?.blur();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded, drawerOpen]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    // Force a fresh chat: the bottom input is for "ask Zervo a quick
    // question", which usually has nothing to do with whatever
    // conversation sessionStorage happens to point at. Users who
    // want to continue an existing thread go through the Recent
    // panel below or the history drawer at top-left.
    open({ initialMessage: trimmed, conversationId: null });
    setValue("");
    setExpanded(false);
  }

  function openConversation(id: string) {
    open({ conversationId: id });
    setExpanded(false);
    setDrawerOpen(false);
    setValue("");
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/agent/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setPendingDeleteId(null);
    } catch {
      // Silent — user can retry.
    } finally {
      setDeleting(false);
    }
  }

  const hasText = value.trim().length > 0;

  return (
    <>
      {/* Soft frosted backdrop while the input is focused. Lives in
          its own AnimatePresence so it can fade independently from
          the input itself, and sits at z-[55] so the input's z-[60]
          layer stays above it. The blur uses the same pattern as the
          full overlay (content-bg tinted, backdrop blur) but lighter
          — a "preview" of the chat state, not a takeover. */}
      <AnimatePresence>
        {!isOpen && expanded && (
          <motion.div
            key="bottom-agent-backdrop"
            className="fixed inset-0 z-[55]"
            style={{
              backdropFilter: "blur(14px) saturate(135%)",
              WebkitBackdropFilter: "blur(14px) saturate(135%)",
              backgroundColor: "color-mix(in oklab, var(--color-content-bg), transparent 35%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Top-left history affordance — only mounted while expanded.
          Its own ref is excluded from click-outside so clicking the
          button doesn't collapse the focused state before the drawer
          gets a chance to open. */}
      <div ref={triggerRef}>
        <AnimatePresence>
          {!isOpen && expanded && (
            <motion.button
              key="bottom-agent-history-trigger"
              type="button"
              onMouseDown={(e) => {
                // Keep input focus through the click so the focused
                // state survives when the drawer closes without a
                // selection.
                e.preventDefault();
              }}
              onClick={() => setDrawerOpen(true)}
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Conversation history"
              className="fixed top-4 left-4 z-[60] inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <FiClock className="h-[18px] w-[18px]" />
            </motion.button>
          )}
        </AnimatePresence>

        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Conversations"
          size="sm"
          side="left"
        >
          {loadingConversations && conversations.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-6 text-center">
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-6 text-center">
              No past conversations.
            </div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className="group relative flex items-center gap-1 rounded-md hover:bg-[var(--color-surface-alt)]/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="flex-1 min-w-0 text-left px-2 py-2"
                  >
                    <div className="text-sm text-[var(--color-fg)] truncate">
                      {c.title?.trim() || "Untitled"}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                      {nowAtMount !== null
                        ? formatRelative(c.last_message_at, nowAtMount)
                        : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(c.id);
                    }}
                    aria-label="Delete conversation"
                    className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 mr-1 rounded-md text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-fg)]/[0.08] hover:text-[var(--color-danger)] transition-opacity"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Drawer>

        <ConfirmOverlay
          isOpen={pendingDeleteId !== null}
          onCancel={() => {
            if (!deleting) setPendingDeleteId(null);
          }}
          onConfirm={confirmDelete}
          title="Delete conversation?"
          description="This permanently removes the conversation and all of its messages."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          busy={deleting}
        />
      </div>

      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="bottom-agent-input"
            ref={containerRef}
            // z-[60] keeps the pill above the focused-state backdrop
            // (z-[55]) and above the sidebar/topbar so the pill — and
            // its expanded recent-history panel — float cleanly over
            // the rest of the chrome when active.
            className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center pb-3 md:pb-5 md:pl-20"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: expanded ? centerOffsetPx : 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
          >
            <div className="pointer-events-auto w-full max-w-[640px] mx-3 md:mx-4 flex flex-col">
              <form onSubmit={handleSubmit}>
                <motion.div
                  animate={{
                    scale: expanded ? 1.015 : 1,
                    boxShadow: expanded
                      ? "0 30px 80px -28px rgba(0,0,0,0.55), 0 6px 20px -10px rgba(0,0,0,0.25)"
                      : "0 14px 32px -18px rgba(0,0,0,0.35), 0 2px 6px -3px rgba(0,0,0,0.18)",
                  }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                  className="relative flex items-center rounded-full bg-[var(--color-surface-alt)]"
                >
                  <span
                    aria-hidden
                    className="ml-3 h-9 w-9 shrink-0 bg-[var(--color-fg)]"
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
                    className="flex-1 bg-transparent py-3.5 pl-2.5 pr-12 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
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
    </>
  );
}
