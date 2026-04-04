"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { useUser } from "../providers/UserProvider";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger" | "dangerSubtle" | "outline" | "glass" | "matte" | "minimal";
  size?: "sm" | "md" | "lg" | "iconSm" | "icon" | "iconLg";
  fullWidth?: boolean;
  loading?: boolean;
};

const baseStyles =
  "inline-flex select-none items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.95] hover:scale-[1.02]";

const variants: Record<string, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-on-accent,white)] hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/10",
  accent:
    "bg-[var(--color-accent)] text-[var(--color-on-accent,white)] hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/10",
  secondary:
    "bg-transparent text-[var(--color-fg)] hover:text-[color-mix(in_oklab,var(--color-fg),var(--color-bg)_30%)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]",
  danger:
    "bg-[var(--color-danger)] text-[var(--color-on-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),black_12%)] focus-visible:ring-[var(--color-danger)]",
  dangerSubtle:
    "bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)] hover:text-[color-mix(in_oklab,var(--color-danger),black_10%)] focus-visible:ring-[var(--color-danger)]",
  outline:
    "bg-transparent border border-[var(--color-border)] text-[var(--color-fg)] shadow-sm hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-all duration-200",
  glass:
    "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/30 backdrop-blur-sm shadow-sm shadow-[var(--color-accent)]/5 transition-all duration-200",
  matte:
    "bg-[var(--color-accent)] text-[var(--color-on-accent)] border-none hover:bg-[var(--color-accent)]/90 shadow-none hover:shadow-md hover:shadow-[var(--color-accent)]/10",
  minimal:
    "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]/50 border-none shadow-none",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth = false, loading = false, children, ...props }, ref) => {
    const { profile } = useUser();
    const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const isDefaultAccent = !profile?.accent_color;

    const sizeClasses =
      size === "sm"
        ? "h-8 px-3 py-2"
        : size === "lg"
          ? "h-11 px-5 py-2"
          : size === "iconSm"
            ? "h-8 w-8 p-0"
            : size === "iconLg"
              ? "h-11 w-11 p-0"
              : size === "icon"
                ? "h-9 w-9 p-0"
                : "h-10 px-4 py-2";

    let variantClasses = variants[variant];

    if (variant === "primary" || variant === "matte") {
      if (!isDefaultAccent) {
        variantClasses = variantClasses
          .replace("text-[var(--color-on-accent)]", "text-white")
          .replace("text-[var(--color-on-accent,white)]", "text-white");
      } else if (isDarkMode) {
        variantClasses = variantClasses
          .replace("text-[var(--color-on-accent)]", "text-black")
          .replace("text-[var(--color-on-accent,white)]", "text-black");
      }
    }

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variantClasses, sizeClasses, fullWidth && "w-full", className)}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
