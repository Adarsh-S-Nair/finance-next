"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
};

const baseStyles =
  "inline-flex select-none items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const variants: Record<string, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-on-primary,white)] hover:bg-[var(--color-primary-hover)]",
  secondary:
    "bg-transparent text-[var(--color-fg)] hover:text-[color-mix(in_oklab,var(--color-fg),var(--color-bg)_30%)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], fullWidth && "w-full", className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;


