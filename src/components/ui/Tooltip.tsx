"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "right" | "top" | "bottom" | "left";
  offset?: number;
}

export default function Tooltip({ content, children, side = "right", offset = 10 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (side) {
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + offset;
          break;
        case "top":
          top = rect.top - offset;
          left = rect.left + rect.width / 2;
          break;
        // Add other cases if needed, defaulting to right for sidebar
        default:
          top = rect.top + rect.height / 2;
          left = rect.right + offset;
      }

      setPosition({ top, left });
    }
  }, [isVisible, side, offset]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      className="w-full"
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVisible && (
              <motion.div
                initial={{ opacity: 0, x: -5, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -5, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: position.top,
                  left: position.left,
                  transform: "translateY(-50%)",
                  zIndex: 60, // Higher than sidebar (50)
                }}
                className="pointer-events-none px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-md whitespace-nowrap -translate-y-1/2 z-[60]"
              >
                {content}
                {/* Arrow */}
                <div
                  className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[var(--color-surface)] border-l border-b border-[var(--color-border)] rotate-45"
                  style={{ zIndex: -1 }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
