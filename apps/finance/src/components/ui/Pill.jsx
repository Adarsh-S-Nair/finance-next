"use client";

import React from "react";

export default function Pill({
  children,
  onClick,
  className = "",
  variant = "default",
  size = "sm"
}) {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none";

  const variantClasses = {
    default: "bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-border)] border border-[var(--color-border)]",
    accent: "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]",
    muted: "bg-[var(--color-muted)]/10 text-[var(--color-muted)] hover:bg-[var(--color-muted)]/20 border border-[var(--color-border)]",
    toggle: "bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-accent)]/10 border border-[var(--color-border)] hover:text-[var(--color-accent)] transition-all duration-200"
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs rounded-md",
    md: "px-3 py-1.5 text-sm rounded-lg",
    lg: "px-4 py-2 text-base rounded-lg"
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      onClick={onClick}
      className={classes}
      type="button"
    >
      {children}
    </button>
  );
}
