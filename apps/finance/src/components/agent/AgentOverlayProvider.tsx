"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type OpenOptions = {
  /** Pre-filled message to send as the first turn after opening. */
  initialMessage?: string;
};

type AgentOverlayContextValue = {
  isOpen: boolean;
  /** Pending message to fire once the overlay mounts AgentChat. */
  pendingMessage: string | null;
  open: (opts?: OpenOptions) => void;
  close: () => void;
  toggle: () => void;
  /** Called by AgentOverlay once it has handed the message off to AgentChat. */
  consumePendingMessage: () => void;
};

const AgentOverlayContext = createContext<AgentOverlayContextValue | null>(null);

/**
 * Global state + Cmd+K (Ctrl+K) keyboard shortcut for the agent
 * overlay. The overlay itself is rendered separately by AgentOverlay
 * inside the app layout — this provider just exposes the open/close
 * API to anywhere in the tree (bottom global input, future entry
 * points, etc).
 *
 * The agent has no public route anymore; the overlay is the only way
 * in. A caller can pass `initialMessage` to `open()` so the user types
 * once into the bottom input and the overlay opens straight into a
 * streaming response.
 */
export function AgentOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  // Ref so the keyboard handler / toggle don't churn the listener.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback((opts?: OpenOptions) => {
    if (opts?.initialMessage) {
      setPendingMessage(opts.initialMessage);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Pending message belongs to the open() that scheduled it. If the
    // user closes before AgentChat mounts (rare), drop it so a later
    // bare open() doesn't fire a stale prompt.
    setPendingMessage(null);
  }, []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const consumePendingMessage = useCallback(() => {
    setPendingMessage(null);
  }, []);

  // Cmd+K / Ctrl+K toggles the overlay from anywhere. We skip when the
  // user is typing inside the chat input (already inside the overlay) —
  // their K keystroke should reach the textarea.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModK =
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (!isModK) return;
      const target = e.target as HTMLElement | null;
      const insideAgentInput = target?.closest?.("[data-agent-chat-input]");
      if (insideAgentInput && isOpenRef.current) return;
      e.preventDefault();
      setIsOpen((v) => !v);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close on Esc.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isOpen,
      pendingMessage,
      open,
      close,
      toggle,
      consumePendingMessage,
    }),
    [isOpen, pendingMessage, open, close, toggle, consumePendingMessage],
  );

  return (
    <AgentOverlayContext.Provider value={value}>
      {children}
    </AgentOverlayContext.Provider>
  );
}

export function useAgentOverlay(): AgentOverlayContextValue {
  const ctx = useContext(AgentOverlayContext);
  if (!ctx) {
    throw new Error(
      "useAgentOverlay must be used inside <AgentOverlayProvider>",
    );
  }
  return ctx;
}
