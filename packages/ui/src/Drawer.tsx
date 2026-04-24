"use client";

import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type DrawerView = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  showBackButton?: boolean;
  noPadding?: boolean;
};

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
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
  /**
   * Mobile layout. Defaults to "sheet" (bottom sheet with drag
   * handle, swipe-to-dismiss). Use "fullscreen" for flows where the
   * drawer should fully take over the viewport (covering the bottom
   * nav) and slide in from the right like on desktop — e.g.
   * transaction details, which are long enough that a bottom sheet
   * forces the user to scroll the content AND the sheet.
   */
  mobileLayout?: "sheet" | "fullscreen";
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
  mobileLayout = "sheet",
}: DrawerProps) {
  const mobileFullscreen = mobileLayout === "fullscreen";
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

  // Whether to use the mobile-fullscreen layout right now. On desktop
  // we always keep the right-side drawer regardless of the prop.
  const useFullscreenOnMobile = mobileFullscreen && isMobile === true;
  // On mobile-fullscreen, always show a close affordance in the header.
  const showCloseButton = useFullscreenOnMobile && !showBackButton;

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={clsx(
            "fixed inset-0 z-[80] flex overflow-hidden overscroll-contain",
            useFullscreenOnMobile
              ? // Full viewport on mobile, right-drawer on desktop
                "items-stretch justify-stretch sm:items-stretch sm:justify-end"
              : // Bottom sheet on mobile, right-drawer on desktop
                "items-end p-0 sm:items-stretch sm:justify-end"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Close"
            className={clsx(
              "absolute inset-0 bg-black/40",
              // On mobile-fullscreen the dialog covers the whole viewport, so
              // the backdrop button is never actually visible. Drop it so it
              // can't intercept taps if the dialog animates in late.
              useFullscreenOnMobile && "hidden sm:block",
            )}
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
              "relative z-10 w-full bg-[var(--color-content-bg)] flex flex-col",
              useFullscreenOnMobile
                ? // Full viewport — no rounding on mobile, still flush to
                  // right on desktop.
                  "rounded-none"
                : // Mobile bottom sheet look (rounded top), desktop flush.
                  "rounded-t-lg rounded-b-none sm:rounded-none",
              // Width constraints only from small screens and up
              size === "sm" && "sm:max-w-sm",
              size === "md" && "sm:max-w-md",
              size === "lg" && "sm:max-w-lg",
              size === "xl" && "sm:max-w-xl",
              // Height constraints
              useFullscreenOnMobile ? "h-full sm:h-full" : "h-[75vh] sm:h-full",
              "overflow-hidden",
              className
            )}
            // Mobile-fullscreen slides in from the right on mobile too so the
            // motion reads as "pushing a new screen onto the stack" (iOS
            // navigation feel) rather than a bottom-sheet rise.
            initial={
              isMobile
                ? useFullscreenOnMobile
                  ? { x: "100%", opacity: 1 }
                  : { y: "100%", opacity: 1 }
                : { x: "100%", opacity: 1 }
            }
            animate={
              isMobile
                ? useFullscreenOnMobile
                  ? { x: 0, opacity: 1 }
                  : { y: 0, opacity: 1 }
                : { x: 0, opacity: 1 }
            }
            exit={
              isMobile
                ? useFullscreenOnMobile
                  ? { x: "100%", opacity: 1 }
                  : { y: "100%", opacity: 1 }
                : { x: "100%", opacity: 1 }
            }
            transition={{ type: "tween", duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            // Swipe-to-dismiss only for bottom-sheet mobile. Fullscreen mode
            // relies on the explicit close button instead.
            drag={isMobile && !useFullscreenOnMobile ? "y" : false}
            dragConstraints={isMobile && !useFullscreenOnMobile ? { top: 0, bottom: 0 } : undefined}
            dragElastic={0.1}
            dragMomentum={false}
            onDragEnd={(event, info) => {
              if (!isMobile || useFullscreenOnMobile) return;
              const draggedFarEnough = info.offset.y > 90;
              const fastEnough = info.velocity.y > 800;
              if (draggedFarEnough || fastEnough) onClose();
            }}
          >
            {/* Mobile drag handle — sheet mode only */}
            {!useFullscreenOnMobile && (
              <div className="sm:hidden flex items-center justify-center pt-3 pb-1 flex-none z-30">
                <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
              </div>
            )}

            {/* Header */}
            <div className="px-5 py-4 flex-none z-20">
              <div className="flex items-center gap-3">
                {showBackButton && (
                  <button
                    onClick={onBack}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
                    aria-label="Go back"
                  >
                    <span className="text-lg leading-none">&#8249;</span>
                  </button>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
                    aria-label="Close"
                  >
                    <span className="text-lg leading-none">&#8249;</span>
                  </button>
                )}
                {(displayTitle || displayDescription) && (
                  <div className="flex-1">
                    {displayTitle && <h3 className="text-base font-medium text-[var(--color-fg)]">{displayTitle}</h3>}
                    {displayDescription && (
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{displayDescription}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <motion.div
                key={currentViewId || 'default'}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={clsx("h-full", currentView?.noPadding ? "" : "px-5 pb-5")}
              >
                {displayContent}
              </motion.div>
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-5 py-4 border-t border-[var(--color-border)] flex-none z-20">
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
