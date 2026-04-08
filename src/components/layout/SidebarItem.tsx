"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";
import { IconType } from "react-icons";
import { FaLock } from "react-icons/fa";
import { Tooltip } from "@slate-ui/react";

interface SidebarItemProps {
  href: string;
  label: string;
  icon?: IconType;
  active?: boolean;
  disabled?: boolean;
  isCollapsed?: boolean;
  notification?: boolean;
  onClick?: () => void;
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
          "group relative flex items-center rounded-lg text-[13px] transition-all duration-150",
          isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
          active
            ? "text-[var(--color-fg)] font-medium bg-[var(--color-chart-primary)]/[0.08] shadow-[inset_0_0_12px_rgba(96,165,250,0.06)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.04]"
        )}
      >
        {/* Active accent bar — full height */}
        {active && (
          <span className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-[var(--color-chart-primary)]" />
        )}

        {/* Icon */}
        {Icon && (
          <span className="relative flex-shrink-0 flex items-center justify-center">
            <Icon
              className={clsx(
                "h-[18px] w-[18px] transition-colors duration-150",
                active && "text-[var(--color-fg)]"
              )}
            />
            {notification && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-chart-primary)] ring-2 ring-[var(--color-bg)]" />
            )}
          </span>
        )}

        {/* Label */}
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {disabled && (
              <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60 flex-shrink-0" />
            )}
          </>
        )}
      </Link>
    </li>
  );

  if (isCollapsed) {
    return <Tooltip content={label}>{item}</Tooltip>;
  }

  return item;
}
