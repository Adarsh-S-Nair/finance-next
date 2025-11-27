"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

export type DropdownItem = {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

type DropdownProps = {
  trigger?: ReactNode;
  label?: string;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
  size?: "sm" | "md";
};

export default function Dropdown({ trigger, label, items, align = "right", className, size = "md" }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const sizeClasses = size === "sm"
    ? "h-8 px-3 text-xs"
    : "h-9 px-4 text-sm";

  return (
    <div ref={dropdownRef} className={clsx("relative", className)}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
            "transition-all duration-200 ease-out",
            "bg-[var(--color-surface)] text-[var(--color-fg)]",
            "border border-[var(--color-border)]",
            "hover:bg-[var(--color-bg)] hover:border-[var(--color-muted)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            sizeClasses
          )}
        >
          <span>{label || "Options"}</span>
          <ChevronDown
            className={clsx(
              "transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            size={size === "sm" ? 14 : 16}
          />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            "absolute top-full mt-2 min-w-[180px] z-50",
            "glass-panel backdrop-blur-md rounded-lg overflow-hidden",
            "border border-[var(--color-border)]",
            "shadow-lg shadow-black/5 dark:shadow-black/30",
            "animate-fade-in",
            align === "right" ? "right-0" : "left-0"
          )}
          style={{
            animation: "slideDown 0.2s ease-out",
          }}
        >
          <div className="py-1">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={clsx(
                  "w-full px-3 py-2 text-left text-xs font-medium",
                  "flex items-center gap-2",
                  "transition-colors duration-150",
                  item.disabled
                    ? "opacity-40 cursor-not-allowed text-[var(--color-muted)]"
                    : "cursor-pointer hover:bg-[var(--color-accent)]/8 active:bg-[var(--color-accent)]/12 text-[var(--color-fg)]"
                )}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add keyframes for slide down animation */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
