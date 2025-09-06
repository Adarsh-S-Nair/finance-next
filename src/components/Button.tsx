"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { useUser } from "./UserProvider";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger" | "dangerSubtle";
  size?: "sm" | "md" | "lg" | "iconSm" | "icon" | "iconLg";
  fullWidth?: boolean;
};

const baseStyles =
  "inline-flex select-none items-center justify-center rounded-md text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const variants: Record<string, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-on-accent,white)] hover:bg-[var(--color-accent-hover)]",
  accent:
    "bg-[var(--color-accent)] text-[var(--color-on-accent,white)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "bg-transparent text-[var(--color-fg)] hover:text-[color-mix(in_oklab,var(--color-fg),var(--color-bg)_30%)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]",
  danger:
    "bg-[var(--color-danger)] text-[var(--color-on-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),black_12%)] focus-visible:ring-[var(--color-danger)]",
  dangerSubtle:
    "bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)] hover:text-[color-mix(in_oklab,var(--color-danger),black_10%)] focus-visible:ring-[var(--color-danger)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth = false, children, ...props }, ref) => {
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
        : "h-10 px-4 py-2"; // md default

    // Special handling for primary buttons in dark mode with default accent
    const primaryVariantClass = variant === "primary" && isDarkMode && isDefaultAccent
      ? "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-hover)]"
      : variants[variant];

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, primaryVariantClass, sizeClasses, fullWidth && "w-full", className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;


