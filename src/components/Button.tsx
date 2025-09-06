"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "iconSm" | "icon" | "iconLg";
  fullWidth?: boolean;
};

const baseStyles =
  "inline-flex select-none items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

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
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth = false, ...props }, ref) => {
    const sizeClasses =
      size === "sm"
        ? "h-8 px-3"
        : size === "lg"
        ? "h-11 px-5"
        : size === "iconSm"
        ? "h-8 w-8 p-0"
        : size === "iconLg"
        ? "h-11 w-11 p-0"
        : size === "icon"
        ? "h-9 w-9 p-0"
        : "h-10 px-4"; // md default
    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizeClasses, fullWidth && "w-full", className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;


