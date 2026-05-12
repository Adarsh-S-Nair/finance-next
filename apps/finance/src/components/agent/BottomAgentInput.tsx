"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiClock } from "react-icons/fi";
import { usePathname } from "next/navigation";
import { useRegisterDrawerOpen } from "@zervo/ui";
import { useAgentOverlay } from "./AgentOverlayProvider";
import AgentHistoryDrawer from "./AgentHistoryDrawer";

// Route-aware placeholder text. The agent works the same everywhere
// but the prompt should feel aware of where the user is — and the
// shift in copy is also how this input visually distinguishes itself
// from page-local search fields (Transactions has one of its own).
const PLACEHOLDERS: Array<{ match: RegExp; text: string }> = [
  { match: /^\/transactions/, text: "Ask about your transactions…" },
  { match: /^\/accounts/, text: "Ask about your accounts…" },
  { match: /^\/investments/, text: "Ask about your portfolio…" },
  { match: /^\/budgets/, text: "Ask about your budgets…" },
];

function placeholderForPath(pathname: string | null): string {
  if (!pathname) return "Ask Zervo anything…";
  for (const { match, text } of PLACEHOLDERS) {
    if (match.test(pathname)) return text;
  }
  return "Ask Zervo anything…";
}

/**
 * Persistent bottom-of-viewport input for summoning the agent from
 * anywhere in the app.
 *
 * Desktop: focus lifts the pill to the vertical center, fades in a
 * frosted backdrop, and surfaces a top-left history clock.
 *
 * Mobile: focus does NOT lift. The pill stays anchored to the bottom
 * and rides above the keyboard via the Visual Viewport API — same
 * pattern as a chat app input. The lift animation fights with the
 * keyboard otherwise (the pill hides behind it on iOS), and at the
 * sizes a phone provides, "lift to center" doesn't add anything.
 *
 * Hidden while the overlay itself is open — the overlay has its own
 * input and history affordances.
 */
export default function BottomAgentInput() {
  const { isOpen, open } = useAgentOverlay();
  const pathname = usePathname();
  const placeholder = useMemo(() => placeholderForPath(pathname), [pathname]);
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Translate-Y in pixels needed to land the input pill at the
  // vertical center of the viewport. Desktop only — mobile keeps the
  // pill bottom-anchored and rides the keyboard instead.
  const [centerOffsetPx, setCenterOffsetPx] = useState(0);
  // True under the sm breakpoint. SSR-safe (starts false, hydrated on
  // mount) so we don't render a "lifted" state for a frame.
  const [isMobile, setIsMobile] = useState(false);
  // How many px the on-screen keyboard is occupying at the bottom of
  // the viewport (mobile only). Driven by the Visual Viewport API so
  // we can keep the pill above the keyboard on iOS — `position: fixed;
  // bottom: 0` sits behind the keyboard there because fixed is
  // relative to the layout viewport, not the visual one.
  const [keyboardOffsetPx, setKeyboardOffsetPx] = useState(0);
  // OS detection for the keyboard-shortcut badge. SSR-safe — starts
  // false (renders "Ctrl K") and gets corrected on mount; the swap to
  // ⌘ K on Mac happens in the same paint as the rest of the hydration
  // pass, so there's no visible flicker.
  const [isMac, setIsMac] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Register the focused state into the drawer-open count so the
  // mobile hamburger steps out of the way (same path AgentHistoryDrawer
  // uses). Without this the hamburger keeps sitting on top of the
  // top-left history clock at z-90 and steals taps.
  useRegisterDrawerOpen(expanded && !isOpen);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

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

  // Visual Viewport keyboard tracking. The difference between the
  // layout viewport (`window.innerHeight`) and the visual viewport
  // (`vv.height + vv.offsetTop`) is how much the keyboard is
  // occupying. We only use this on mobile — on desktop there's no
  // virtual keyboard, so the offset is always 0.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      if (!vv) return;
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffsetPx(Math.max(0, overlap));
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // OS sniff for the kbd badge. `navigator.userAgentData.platform` is
  // the modern API but Chromium-only; `navigator.platform` is
  // deprecated but still the most reliable signal for this specific
  // mac-vs-not check across all browsers. Falling back through both
  // covers every current environment.
  useEffect(() => {
    const nav = navigator as unknown as {
      userAgentData?: { platform?: string };
      platform?: string;
    };
    const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
    setIsMac(/mac/i.test(platform));
  }, []);

  // Global ⌘K / Ctrl+K — focuses the input from anywhere in the app.
  // Skipped while the overlay itself is open (it has its own input,
  // double-focus would steal it away). preventDefault keeps Firefox's
  // address-bar search and any browser-level "quick find" off the
  // shortcut.
  useEffect(() => {
    if (isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      const isShortcut =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k";
      if (!isShortcut) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

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
    // want to continue an existing thread go through the history
    // drawer at top-left.
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

  const hasText = value.trim().length > 0;

  return (
    <>
      {/* Soft frosted backdrop while the input is focused. Desktop
          only — on mobile the keyboard already telegraphs "input
          mode" and the page underneath is naturally hidden, so the
          extra blur layer is just visual noise (and potentially a
          performance hit on mid-range phones). Mobile keeps the pill
          + history clock on top of the unblurred page. */}
      <AnimatePresence>
        {!isOpen && expanded && !isMobile && (
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

        <AgentHistoryDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSelect={openConversation}
        />
      </div>

      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="bottom-agent-input"
            ref={containerRef}
            className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center pb-3 md:pb-5 md:pl-20"
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              // Mobile: ride the keyboard. Desktop: lift to center on
              // focus, sit at rest otherwise.
              y: isMobile
                ? -keyboardOffsetPx
                : expanded
                ? centerOffsetPx
                : 0,
            }}
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
                  {/* Logo at rest, Siri-style orb when focused. Two
                      stacked layers crossfade with a subtle scale to
                      feel like a morph rather than a hard swap:
                      - Resting layer: masked logo silhouette (solid
                        fg fill, mask-image clipped to logo shape).
                      - Focused layer: a true circle composed of four
                        independently-orbiting colored blobs over a
                        dark base, plus a glassy top-left highlight
                        (see .siri-orb / .siri-blob in globals.css).
                      Blobs are only mounted while focused — no point
                      running 4 animations off-screen. */}
                  <div aria-hidden className="ml-3 h-8 w-8 shrink-0 relative">
                    <div
                      className="absolute inset-0 bg-[var(--color-fg)]"
                      style={{
                        opacity: expanded ? 0 : 1,
                        transform: expanded ? "scale(0.88)" : "scale(1)",
                        transition: "opacity 260ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
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
                    <div
                      className="absolute inset-0 rounded-full siri-orb"
                      style={{
                        opacity: expanded ? 1 : 0,
                        transform: expanded ? "scale(1)" : "scale(0.82)",
                        transition: "opacity 260ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
                        boxShadow: expanded
                          ? "0 0 14px -2px color-mix(in oklab, var(--color-neon-purple), transparent 60%)"
                          : "none",
                      }}
                    >
                      {expanded && (
                        <>
                          <span className="siri-blob siri-blob-1" />
                          <span className="siri-blob siri-blob-2" />
                          <span className="siri-blob siri-blob-3" />
                          <span className="siri-blob siri-blob-4" />
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setExpanded(true)}
                    placeholder={placeholder}
                    aria-label="Ask the agent"
                    // text-base on mobile keeps the actual font-size
                    // at 16px, which is what iOS Safari needs to skip
                    // the "zoom on focus" gesture; sm:text-sm pulls
                    // it back to 14px on desktop where the visual
                    // density of the surrounding chrome lives.
                    className="flex-1 bg-transparent py-3.5 pl-2.5 pr-20 text-base sm:text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
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
                  {/* Keyboard-shortcut hint. Two borderless mini-keys
                      in the macOS-menu style — each character in its
                      own subtly filled rounded box. Hidden on mobile
                      (no physical kbd), while focused (you've already
                      summoned the input — the reminder is noise),
                      and while there's text (the send button takes
                      this slot). */}
                  <AnimatePresence>
                    {!hasText && !expanded && !isMobile && (
                      <motion.div
                        key="kbd"
                        aria-hidden
                        initial={{ opacity: 0, y: "-50%" }}
                        animate={{ opacity: 1, y: "-50%" }}
                        exit={{ opacity: 0, y: "-50%" }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-3 top-1/2 pointer-events-none flex items-center gap-1 text-[var(--color-muted)]"
                      >
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-[var(--color-fg)]/[0.07] text-[12px] font-medium leading-none">
                          {isMac ? "⌘" : "Ctrl"}
                        </span>
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-[var(--color-fg)]/[0.07] text-[12px] font-medium leading-none">
                          K
                        </span>
                      </motion.div>
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
