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
  /**
   * Override which conversation the overlay loads:
   * - omit: resume whatever conversation sessionStorage points at
   * - `null`: force a fresh chat (welcome screen / new conversation)
   * - string id: load that specific conversation
   *
   * Cmd+K and the bottom-input submit path both pass `null` so a
   * stale `agent:lastConvId` in sessionStorage doesn't surface old
   * threads when the user clearly wanted a new question.
   */
  conversationId?: string | null;
};

type AgentOverlayContextValue = {
  isOpen: boolean;
  /** Pending message to fire once the overlay mounts AgentChat. */
  pendingMessage: string | null;
  /**
   * Pending conversation override. `undefined` means the caller didn't
   * specify and the overlay should fall back to sessionStorage; `null`
   * forces a fresh chat; a string forces that specific conversation.
   */
  pendingConversationId: string | null | undefined;
  open: (opts?: OpenOptions) => void;
  close: () => void;
  /** Called by AgentOverlay once it has snapshotted message + override. */
  consumePending: () => void;
};

const AgentOverlayContext = createContext<AgentOverlayContextValue | null>(null);

/**
 * Global state + Cmd+K (Ctrl+K) keyboard shortcut for the agent
 * overlay. The overlay itself is rendered separately by AgentOverlay
 * inside the app layout — this provider just exposes the open/close
 * API to anywhere in the tree (bottom global input, future entry
 * points, etc).
 *
 * The agent has no public route; the overlay is the only way in.
 * Callers can pass `initialMessage` and/or `conversationId` to
 * `open()` so the overlay opens straight into the right context.
 */
export function AgentOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null | undefined
  >(undefined);
  // Ref so the keyboard handler doesn't churn the listener.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback((opts?: OpenOptions) => {
    if (opts?.initialMessage) {
      setPendingMessage(opts.initialMessage);
    }
    if (opts && "conversationId" in opts) {
      setPendingConversationId(opts.conversationId);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Pending state belongs to the open() that scheduled it. If the
    // user closes before AgentChat mounts (rare), drop both so a
    // future bare open() doesn't replay stale context.
    setPendingMessage(null);
    setPendingConversationId(undefined);
  }, []);

  const consumePending = useCallback(() => {
    setPendingMessage(null);
    setPendingConversationId(undefined);
  }, []);

  // Cmd+K / Ctrl+K: open a fresh chat from anywhere, or close if
  // already open. We skip when the user is typing inside the chat
  // input (already inside the overlay) — their K keystroke should
  // reach the textarea.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModK =
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (!isModK) return;
      const target = e.target as HTMLElement | null;
      const insideAgentInput = target?.closest?.("[data-agent-chat-input]");
      if (insideAgentInput && isOpenRef.current) return;
      e.preventDefault();
      if (isOpenRef.current) {
        setIsOpen(false);
        setPendingMessage(null);
        setPendingConversationId(undefined);
      } else {
        // Force fresh — don't surface a stale sessionStorage thread.
        setPendingConversationId(null);
        setIsOpen(true);
      }
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

  // Lock background scroll while open. Lock both <html> and <body>
  // because some pages put the scroll context on the documentElement
  // (Tailwind defaults vary by browser), and locking only one lets the
  // page peek-scroll behind the overlay.
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isOpen,
      pendingMessage,
      pendingConversationId,
      open,
      close,
      consumePending,
    }),
    [isOpen, pendingMessage, pendingConversationId, open, close, consumePending],
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
