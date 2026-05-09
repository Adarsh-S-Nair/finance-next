"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { useAgentOverlay } from "./AgentOverlayProvider";

/**
 * Persistent bottom-of-viewport input for summoning the agent from
 * anywhere in the app. Typing + Enter opens the overlay with the
 * message pre-fired so users get an answer in one step. Clicking the
 * empty input opens the overlay onto the welcome screen.
 *
 * Hidden while the overlay is already open — the overlay has its own
 * input — and on a few routes where it would just get in the way.
 */
export default function BottomAgentInput() {
  const { isOpen, open } = useAgentOverlay();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-arm focus when the overlay closes if the user was mid-typing.
  useEffect(() => {
    if (!isOpen && focused) {
      inputRef.current?.focus();
    }
  }, [isOpen, focused]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    open({ initialMessage: trimmed });
    setValue("");
  }

  const hasText = value.trim().length > 0;

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          key="bottom-agent-input"
          className="fixed inset-x-0 bottom-0 z-30 pointer-events-none flex justify-center pb-3 md:pb-5 md:pl-20"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <form
            onSubmit={handleSubmit}
            className="pointer-events-auto relative w-full max-w-[640px] mx-3 md:mx-4"
          >
            <div className="relative flex items-center rounded-full bg-[var(--color-surface)]/95 border border-[var(--color-border)] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/85 transition-shadow hover:shadow-xl focus-within:shadow-xl focus-within:border-[var(--color-fg)]/20">
              <span className="pl-4 pr-2 text-[var(--color-muted)] flex items-center">
                <LuSparkles className="h-4 w-4" />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Ask Zervo anything…"
                aria-label="Ask the agent"
                className="flex-1 bg-transparent py-3 pr-12 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
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
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
