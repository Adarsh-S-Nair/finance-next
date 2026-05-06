"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type AgentOverlayContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const AgentOverlayContext = createContext<AgentOverlayContextValue | null>(null);

/**
 * Global state + Cmd+K (Ctrl+K) keyboard shortcut for the agent
 * overlay. The overlay itself is rendered separately by AgentOverlay
 * inside the app layout — this provider just exposes the open/close
 * API to anywhere in the tree (topbar button, page links, etc).
 *
 * The overlay is in addition to the /agent page route — direct URL
 * navigation still works as before, but the overlay lets users
 * summon the agent from anywhere without losing their place.
 */
export function AgentOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  // The dedicated /agent page already renders the chat full-page. Opening
  // the overlay there would mount a second AgentChat on top of the first
  // — same conversation, two copies. Suppress the overlay on those routes.
  const onAgentRoute = pathname?.startsWith("/agent") ?? false;

  const open = useCallback(() => {
    if (onAgentRoute) return;
    setIsOpen(true);
  }, [onAgentRoute]);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    if (onAgentRoute) {
      // On the agent route, the only useful action is close (if it
      // somehow got opened). Never toggle to open from here.
      setIsOpen(false);
      return;
    }
    setIsOpen((v) => !v);
  }, [onAgentRoute]);

  // Auto-close the overlay if the user navigates to /agent (e.g. via
  // sidebar link). The dedicated page takes over from there.
  useEffect(() => {
    if (onAgentRoute && isOpen) setIsOpen(false);
  }, [onAgentRoute, isOpen]);

  // Global keyboard shortcut. Cmd+K on Mac, Ctrl+K elsewhere.
  // Registered on document so it fires regardless of focus, but we
  // skip when the user is typing in a contenteditable / textarea
  // / input that already binds K (e.g. in-page search). Browsers
  // sometimes use Cmd+K for the address bar — `preventDefault` keeps
  // the shortcut for our app.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModK =
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (!isModK) return;
      // Allow override if the user is in the middle of a chat input
      // already — they probably meant to type, not summon. We detect
      // this by checking if the active element is inside an existing
      // agent chat textarea (data-attr set on the AgentChat input).
      // Plain text inputs elsewhere in the app don't block the
      // shortcut — Cmd+K should always work as a global summon.
      const target = e.target as HTMLElement | null;
      const insideAgentInput = target?.closest?.("[data-agent-chat-input]");
      if (insideAgentInput && isOpen) {
        // If the agent is already open and the user is typing in its
        // input, don't toggle. They're focused on a different action.
        return;
      }
      e.preventDefault();
      toggle();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle, isOpen]);

  // Close on Esc when open. Same scope as the Cmd+K listener.
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

  // Lock body scroll while the overlay is open. Prevents the
  // background page from scrolling when the user scrolls inside the
  // chat. Restored on close.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
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
