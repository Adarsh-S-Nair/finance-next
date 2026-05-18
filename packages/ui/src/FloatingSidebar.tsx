"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import { IconType } from "react-icons";
import SidebarItem from "./SidebarItem";
import Tooltip from "./Tooltip";

// SidebarItem in icon-only mode renders at 34px tall (18px icon + 8px pad
// each side). With space-y-0.5 (2px) between items, each slot is 36px.
const ITEM_HEIGHT = 34;
const ITEM_SLOT = 36;

export interface FloatingSidebarNavItem {
  href: string;
  label: string;
  icon?: IconType;
  disabled?: boolean;
  active?: boolean;
}

export interface FloatingSidebarBottomLink {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
}

export interface FloatingSidebarProps {
  /** Content above the nav (e.g. household scope avatar). Omit for a clean top. */
  header?: React.ReactNode;
  /** Items in nav order. At most one should have `active: true`. */
  items: FloatingSidebarNavItem[];
  /** Content above the bottom link and below the nav (e.g. a "more" menu). */
  footer?: React.ReactNode;
  /** Optional pinned-to-bottom link with its own accent bar (e.g. Settings). */
  bottomLink?: FloatingSidebarBottomLink;
  /**
   * CSS value for the fixed frame's `top` inset. Defaults to "12px". Use a
   * `calc(...)` expression to clear a banner (e.g.
   * `"calc(var(--impersonation-banner-h, 0px) + 12px)"`).
   */
  topInset?: string;
  /** CSS value for the fixed frame's `bottom` inset. Defaults to "12px". */
  bottomInset?: string;
  /** Called when any nav link is clicked. Used by mobile drawers for dismissal. */
  onNavigate?: () => void;
  /**
   * Wrap the pill in the outer `<aside class="fixed">` frame. Default true.
   * Set false when embedding in a custom container (e.g. a mobile drawer).
   */
  withFixedFrame?: boolean;
}

/**
 * Floating, icon-only sidebar pinned to the left edge — a vertical pill
 * that floats above the content with rounded corners, a soft shadow, and
 * an animated active-item indicator that springs between rows. Shared
 * across all Zervo apps so navigation feels identical regardless of
 * surface (finance, admin, developer).
 *
 * The active indicator is rendered once at the pill level (rather than
 * per-item with framer-motion's shared-layout tracking) because the
 * shared-layout cache occasionally loses position when sidebar items
 * unmount/remount, causing the highlight to slide in from the bottom of
 * the list. A single position-animated bar sidesteps that entirely.
 */
export default function FloatingSidebar({
  header,
  items,
  footer,
  bottomLink,
  topInset = "12px",
  bottomInset = "12px",
  onNavigate,
  withFixedFrame = true,
}: FloatingSidebarProps) {
  const activeIndex = items.findIndex((it) => it.active);

  const pill = (
    <div className="relative flex h-full w-full flex-col py-3 rounded-[20px] bg-[var(--color-bg)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-3px_rgba(0,0,0,0.06)] overflow-hidden">
      {header && <div className="flex justify-center pb-2">{header}</div>}

      <nav className="relative flex-1 overflow-y-auto scrollbar-thin">
        {activeIndex >= 0 && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-0 w-[3px] bg-[var(--color-fg)]"
            style={{ height: ITEM_HEIGHT, top: 0 }}
            initial={false}
            animate={{ y: activeIndex * ITEM_SLOT }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
        <ul className="space-y-0.5">
          {items.map((it) => (
            <SidebarItem
              key={`${it.href}:${it.label}`}
              href={it.href}
              label={it.label}
              icon={it.icon}
              active={Boolean(it.active)}
              disabled={it.disabled}
              isCollapsed
              externalActiveHighlight
              onClick={onNavigate}
            />
          ))}
        </ul>
      </nav>

      {(footer || bottomLink) && (
        <div className="relative flex flex-col gap-0.5 pt-2">
          {bottomLink?.active && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 w-[3px] bg-[var(--color-fg)]"
              style={{ height: 40, bottom: 0 }}
            />
          )}
          {footer}
          {bottomLink && (
            <Tooltip content={bottomLink.label} side="right">
              <Link
                href={bottomLink.href}
                onClick={onNavigate}
                aria-label={bottomLink.label}
                className={clsx(
                  "flex items-center justify-center w-full h-10 transition-colors",
                  bottomLink.active
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                )}
              >
                <bottomLink.icon className="h-[18px] w-[18px]" />
              </Link>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );

  if (!withFixedFrame) return pill;

  return (
    <aside
      className="hidden md:block fixed left-3 w-14 z-50"
      style={{ top: topInset, bottom: bottomInset }}
    >
      {pill}
    </aside>
  );
}
