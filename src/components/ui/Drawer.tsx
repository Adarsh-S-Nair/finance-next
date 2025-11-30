"use client";

import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { FiArrowLeft } from "react-icons/fi";

type DrawerView = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  showBackButton?: boolean;
};

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
  className?: string;
  // New navigation props
  views?: DrawerView[];
  currentViewId?: string;
  onViewChange?: (viewId: string) => void;
  onBack?: () => void;
};

export default function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer,
  className,
  views = [],
  currentViewId,
  onViewChange,
  onBack,
}: DrawerProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  // Detect viewport before paint to avoid initial layout pop/glitch
  useLayoutEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(max-width: 639px)").matches);
    check();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(max-width: 639px)").matches);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Store original styles
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    const topbar = document.getElementById('app-topbar');
    const originalTopbarPaddingRight = topbar ? topbar.style.paddingRight : '';

    // Apply styles
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');

    // Add padding to body to prevent content shift
    document.body.style.paddingRight = `${parseInt(window.getComputedStyle(document.body).paddingRight || '0') + scrollbarWidth}px`;

    // Add padding to fixed topbar to prevent shift
    if (topbar) {
      topbar.style.paddingRight = `${parseInt(window.getComputedStyle(topbar).paddingRight || '0') + scrollbarWidth}px`;
    }

    return () => {
      // Restore styles
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
      if (topbar) {
        topbar.style.paddingRight = originalTopbarPaddingRight;
      }
    };
  }, [isOpen]);

  // Avoid SSR/CSR mismatch and enable portal rendering above any stacking contexts
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Get current view or fallback to default content
  const currentView = views.find(view => view.id === currentViewId);
  const displayTitle = currentView?.title || title;
  const displayDescription = currentView?.description || description;
  const displayContent = currentView?.content || children;
  const showBackButton = currentView?.showBackButton && onBack;

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={clsx(
            "fixed inset-0 z-50 flex overflow-hidden overscroll-contain",
            // Bottom sheet on mobile
            "items-end p-0",
            // Right-side drawer from small screens and up
            "sm:items-start sm:justify-end sm:p-4"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={clsx(
              "relative z-10 w-full border border-[var(--color-border)] bg-[var(--color-content-bg)] shadow-xl flex flex-col",
              // Mobile bottom sheet look
              "rounded-t-lg rounded-b-none",
              // Desktop drawer look - all corners rounded
              "sm:rounded-lg",
              // Width constraints only from small screens and up
              size === "sm" && "sm:max-w-sm",
              size === "md" && "sm:max-w-md",
              size === "lg" && "sm:max-w-lg",
              size === "xl" && "sm:max-w-xl",
              // Height constraints
              "h-[75vh] sm:h-full sm:max-h-[100vh]",
              // Scroll behavior: scrollbar on parent, header sticky
              "overflow-y-auto",
              className
            )}
            // Animate differently for mobile bottom sheet vs desktop right drawer
            initial={isMobile ? { y: "100%", opacity: 1 } : { x: "100%", opacity: 1 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: "100%", opacity: 1 } : { x: "100%", opacity: 1 }}
            transition={isMobile ? { type: "tween", duration: 0.2, ease: "easeOut" } : { type: "tween", duration: 0.2, ease: "easeOut" }}
            // Enable swipe-to-dismiss on mobile
            drag={isMobile ? "y" : false}
            dragConstraints={isMobile ? { top: 0, bottom: 0 } : undefined}
            dragElastic={0.1}
            dragMomentum={false}
            onDragEnd={(event, info) => {
              if (!isMobile) return;
              const draggedFarEnough = info.offset.y > 90; // pulled down ~90px
              const fastEnough = info.velocity.y > 800; // fast downward flick
              if (draggedFarEnough || fastEnough) onClose();
            }}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex items-center justify-center pt-3 pb-1 flex-none sticky top-0 bg-[var(--color-content-bg)] z-30">
              <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
            </div>

            {/* Header with back button */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex-none bg-[var(--color-content-bg)] z-20 sticky top-0 sm:top-0">
              <div className="flex items-center gap-3">
                {showBackButton && (
                  <button
                    onClick={onBack}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] transition-colors cursor-pointer"
                    aria-label="Go back"
                  >
                    <FiArrowLeft className="h-4 w-4 text-[var(--color-fg)]" />
                  </button>
                )}
                {(displayTitle || displayDescription) && (
                  <div className="flex-1">
                    {displayTitle && <h3 className="text-base font-semibold text-[var(--color-fg)]">{displayTitle}</h3>}
                    {displayDescription && (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{displayDescription}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content with slide animation */}
            <div className="flex-1 min-h-0">
              <motion.div
                key={currentViewId || 'default'}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-full px-4 pb-4"
              >
                {displayContent}
              </motion.div>
            </div>

            {footer && (
              <div className="p-4 border-t border-[var(--color-border)]/50 flex-none bg-[var(--color-content-bg)] sticky bottom-0 z-20">
                <div className="flex items-center justify-end gap-2">{footer}</div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(drawerContent, document.body);
}
