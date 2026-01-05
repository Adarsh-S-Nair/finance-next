"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { ChevronDown, Check } from "lucide-react";

export type DropdownItem = {
  label: string;
  value?: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
};

type DropdownProps = {
  trigger?: ReactNode;
  label?: string;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
  size?: "sm" | "md";
  maxHeight?: number;
  matchTriggerWidth?: boolean;
};

export default function Dropdown({
  trigger,
  label,
  items,
  align = "right",
  className,
  size = "md",
  maxHeight = 200,
  matchTriggerWidth = true
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  // Measure trigger width when it changes
  useEffect(() => {
    if (triggerRef.current && matchTriggerWidth) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [label, matchTriggerWidth, isOpen]);

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
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "inline-flex items-center justify-between gap-2 rounded-lg font-medium whitespace-nowrap",
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
              "transition-transform duration-200 flex-shrink-0",
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
            "absolute top-full mt-1 z-50",
            "glass-panel backdrop-blur-md rounded-lg overflow-hidden",
            "border border-[var(--color-border)]",
            "shadow-lg shadow-black/5 dark:shadow-black/30",
            align === "right" ? "right-0" : "left-0"
          )}
          style={{
            animation: "slideDown 0.15s ease-out",
            minWidth: matchTriggerWidth && triggerWidth > 0 ? `${triggerWidth}px` : undefined,
          }}
        >
          {/* Scrollable Options List */}
          <div
            className="py-1 overflow-y-auto"
            style={{ maxHeight: `${maxHeight}px` }}
          >
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
                  "w-full px-3 py-1.5 text-left text-xs font-medium",
                  "flex items-center justify-between gap-2",
                  "transition-colors duration-150",
                  item.disabled
                    ? "opacity-40 cursor-not-allowed text-[var(--color-muted)]"
                    : "cursor-pointer hover:bg-[var(--color-accent)]/8 active:bg-[var(--color-accent)]/12 text-[var(--color-fg)]",
                  item.selected && "bg-[var(--color-accent)]/5"
                )}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
                {item.selected && (
                  <Check size={12} className="text-[var(--color-accent)] flex-shrink-0" />
                )}
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
            transform: translateY(-4px);
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
