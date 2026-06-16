"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * A panel anchored under an element, rendered in a portal so it floats above
 * any overflow-clipping ancestor (e.g. a scrollable Modal or the full-screen
 * Add-account overlay). Repositions on scroll/resize and closes on outside
 * click or Escape.
 *
 * Children should mark themselves with [data-floating-panel] (the wrapper
 * already does) so the outside-click handler ignores clicks inside the panel.
 */
export default function FloatingPanel({
  anchorRef,
  open,
  onClose,
  children,
  maxHeight = 280,
  offset = 6,
}) {
  const [rect, setRect] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + offset, left: r.left, width: r.width });
  }, [anchorRef, offset]);

  useEffect(() => {
    if (!open) return;
    update();
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const onDown = (e) => {
      const a = anchorRef.current;
      if (a && a.contains(e.target)) return;
      if (e.target.closest?.("[data-floating-panel]")) return;
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted || !open || !rect) return null;

  return createPortal(
    <div
      data-floating-panel
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        maxHeight,
        zIndex: 130,
      }}
      className="overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-floating-bg)] shadow-xl"
    >
      {children}
    </div>,
    document.body
  );
}
