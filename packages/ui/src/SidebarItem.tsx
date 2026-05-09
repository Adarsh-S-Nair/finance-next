"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import { IconType } from "react-icons";
import { FaLock } from "react-icons/fa";
import Tooltip from "./Tooltip";
interface SidebarItemProps {
  href: string;
  label: string;
  icon?: IconType;
  active?: boolean;
  disabled?: boolean;
  isCollapsed?: boolean;
  notification?: boolean;
  onClick?: () => void;
  /**
   * When true, suppresses the per-item layoutId-based active highlight.
   * The consumer is expected to render its own highlight element (e.g.
   * a single position-animated overlay) so the active indicator survives
   * navigation without relying on framer-motion's shared-layout
   * tracking — that tracking occasionally loses its position cache when
   * SidebarItems unmount and remount, causing the highlight to slide in
   * from the bottom of the list. Active text color + font weight still
   * apply.
   */
  externalActiveHighlight?: boolean;
}

export default function SidebarItem({
  href,
  label,
  icon: Icon,
  active = false,
  disabled = false,
  isCollapsed = false,
  notification = false,
  onClick,
  externalActiveHighlight = false,
}: SidebarItemProps) {
  const item = (
    <li>
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        aria-disabled={disabled || undefined}
        className={clsx(
          "group relative flex items-center text-[13px]",
          isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
          active
            ? "text-[var(--color-fg)] font-medium"
            : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
        )}
      >
        {/* Shared-layout active highlight + accent bar. Both elements
            carry a layoutId so framer-motion animates them between
            sidebar items as the user navigates — the highlight
            "slides" from the previously-active row to the new one
            (Discord-style), instead of disappearing/reappearing.
            When `externalActiveHighlight` is true, the consumer
            renders the highlight itself and we skip these spans. */}
        {active && !externalActiveHighlight && (
          <>
            <motion.span
              layoutId="sidebar-active-bg"
              className="absolute inset-0 bg-[var(--color-fg)]/[0.08]"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
            <motion.span
              layoutId="sidebar-active-bar"
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--color-fg)]"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          </>
        )}

        {/* Icon */}
        {Icon && (
          <span className="relative flex-shrink-0 flex items-center justify-center z-[1]">
            <Icon
              className={clsx(
                "h-[18px] w-[18px]",
                active && "text-[var(--color-fg)]",
              )}
            />
            {notification && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-fg)] ring-2 ring-[var(--color-bg)]" />
            )}
          </span>
        )}

        {/* Label */}
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate relative z-[1]">{label}</span>
            {disabled && (
              <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60 flex-shrink-0 relative z-[1]" />
            )}
          </>
        )}
      </Link>
    </li>
  );

  if (isCollapsed) {
    return <Tooltip content={label} side="right">{item}</Tooltip>;
  }

  return item;
}
