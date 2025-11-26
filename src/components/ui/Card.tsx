"use client";

import React, { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "subtle" | "danger" | "glass";
  width?: "full" | "2/3" | "1/3" | "1/2" | "1/4";
  allowOverflow?: boolean;
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
};

export default function Card({
  children,
  className,
  padding = "md",
  variant = "glass", // Default to glass for the new look
  width = "full",
  allowOverflow = false,
  onMouseLeave,
  onMouseEnter
}: CardProps) {
  const paddingClasses = {
    none: "p-0",
    sm: "p-3",
    md: "p-5",
    lg: "p-8"
  };

  const widthClasses = {
    full: "w-full",
    "2/3": "w-full md:w-2/3",
    "1/3": "w-full md:w-1/3",
    "1/2": "w-full md:w-1/2",
    "1/4": "w-full md:w-1/4"
  };

  // Glassmorphism and gradient border styles
  const variantClasses = {
    default: "bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-soft",
    subtle: "bg-[var(--color-bg)] border border-[var(--color-card-border)]",
    danger: "bg-[color-mix(in_oklab,var(--color-danger),transparent_95%)] border border-[color-mix(in_oklab,var(--color-danger),transparent_80%)]",
    glass: "glass-panel backdrop-blur-md"
  };

  return (
    <div
      className={clsx(
        "rounded-xl relative transition-all duration-300", // Increased corner rounding
        allowOverflow ? "overflow-visible" : "overflow-hidden",
        paddingClasses[padding],
        widthClasses[width],
        variantClasses[variant],
        className
      )}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {variant === 'glass' && (
        <div className="absolute inset-0 pointer-events-none border border-white/5 dark:border-white/[0.02] rounded-xl" />
      )}
      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
}
