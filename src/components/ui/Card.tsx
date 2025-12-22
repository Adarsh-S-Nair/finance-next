"use client";

import React, { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  title?: ReactNode;
  action?: ReactNode;
  titleClassName?: string;
  titleColor?: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  background?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "subtle" | "danger" | "glass";
  width?: "full" | "2/3" | "1/3" | "1/2" | "1/4";
  allowOverflow?: boolean;
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
  onClick?: () => void;
};

export default function Card({
  title,
  action,
  titleClassName,
  titleColor,
  children,
  className,
  style,
  background,
  padding = "md",
  variant = "glass", // Default to glass for the new look
  width = "full",
  allowOverflow = false,
  onMouseLeave,
  onMouseEnter,
  onClick
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
      style={style}
      className={clsx(
        "rounded-xl relative transition-all duration-300 flex flex-col", // Increased corner rounding, flex col for header
        allowOverflow ? "overflow-visible" : "overflow-hidden",
        widthClasses[width],
        variantClasses[variant],
        className
      )}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {background}

      {variant === 'glass' && (
        <div className="absolute inset-0 pointer-events-none border border-white/5 dark:border-white/[0.02] rounded-xl" />
      )}

      {/* Header Section */}
      {(title || action) && (
        <div className={clsx(
          "relative z-10 flex items-center justify-between",
          // If padding is none, we still want some padding for the header usually, 
          // but let's respect the padding prop for consistency, or default to md for header if none
          padding === 'none' ? 'px-5 pt-5 pb-2' : clsx(paddingClasses[padding], 'pb-2')
        )}>
          {title && (
            <div className={clsx(
              "text-sm font-medium",
              titleColor || "text-zinc-500 dark:text-zinc-400",
              titleClassName
            )}>
              {title}
            </div>
          )}
          {action && <div>{action}</div>}
        </div>
      )}

      <div className={clsx(
        "relative z-10 flex-1 min-h-0",
        // If header exists, reduce top padding of content
        (title || action) && padding !== 'none' ? 'pt-0' : '',
        paddingClasses[padding]
      )}>
        {children}
      </div>
    </div>
  );
}
