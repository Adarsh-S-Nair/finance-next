"use client";

import { ReactElement, ReactNode, cloneElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

/**
 * Shared surface styles for any floating element — tooltips, context menus,
 * chart popovers. Kept here so they all read as the same "raised card"
 * language across the app.
 */
export const TOOLTIP_SURFACE_CLASSES =
  "rounded-lg bg-[var(--color-surface-alt)] ring-1 ring-[var(--color-fg)]/[0.08] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: Side;
  /** Render delay before showing. Default 120ms — snappier than a browser title. */
  delay?: number;
}

const OFFSET = 8;

function computePosition(rect: DOMRect, side: Side, tipWidth: number, tipHeight: number) {
  const margin = 4;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (side) {
    case "right":
      top = rect.top + rect.height / 2 - tipHeight / 2;
      left = rect.right + OFFSET;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tipHeight / 2;
      left = rect.left - tipWidth - OFFSET;
      break;
    case "top":
      top = rect.top - tipHeight - OFFSET;
      left = rect.left + rect.width / 2 - tipWidth / 2;
      break;
    case "bottom":
    default:
      top = rect.bottom + OFFSET;
      left = rect.left + rect.width / 2 - tipWidth / 2;
      break;
  }

  // Clamp inside the viewport.
  left = Math.max(margin, Math.min(left, viewportW - tipWidth - margin));
  top = Math.max(margin, Math.min(top, viewportH - tipHeight - margin));
  return { top, left };
}

export default function Tooltip({ content, children, side = "top", delay = 120 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const cancelTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleOpen = () => {
    cancelTimer();
    timeoutRef.current = setTimeout(() => setOpen(true), delay);
  };

  const close = () => {
    cancelTimer();
    setOpen(false);
  };

  // Recompute position after the tip is mounted so we know its width/height.
  useEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipRect = tipRef.current.getBoundingClientRect();
    setPos(computePosition(rect, side, tipRect.width, tipRect.height));
  }, [open, side, content]);

  useEffect(() => () => cancelTimer(), []);

  if (!content) return children;

  // Clone the child to attach hover/focus listeners and the ref.
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as unknown as { ref?: unknown }).ref;
      if (typeof childRef === "function") {
        (childRef as (n: HTMLElement | null) => void)(node);
      } else if (childRef && typeof childRef === "object" && childRef !== null) {
        (childRef as { current: HTMLElement | null }).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      (children.props as { onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void })
        .onMouseEnter?.(e);
      scheduleOpen();
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      (children.props as { onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void })
        .onMouseLeave?.(e);
      close();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      (children.props as { onFocus?: (e: React.FocusEvent<HTMLElement>) => void })
        .onFocus?.(e);
      scheduleOpen();
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      (children.props as { onBlur?: (e: React.FocusEvent<HTMLElement>) => void })
        .onBlur?.(e);
      close();
    },
  } as Partial<React.HTMLAttributes<HTMLElement>> & { ref?: unknown });

  const tip =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tipRef}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                  position: "fixed",
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  zIndex: 90,
                  pointerEvents: "none",
                }}
                className={clsx(
                  TOOLTIP_SURFACE_CLASSES,
                  "px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg)] max-w-xs",
                )}
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger}
      {tip}
    </>
  );
}
