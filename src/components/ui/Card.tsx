"use client";

import React, { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  variant?: "default" | "subtle" | "danger";
  width?: "full" | "2/3" | "1/3" | "1/2" | "1/4";
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
};

export default function Card({ 
  children, 
  className, 
  padding = "md",
  variant = "default",
  width = "full",
  onMouseLeave,
  onMouseEnter
}: CardProps) {
  const paddingClasses = {
    sm: "p-3",
    md: "p-4", 
    lg: "p-6"
  };

  const widthClasses = {
    full: "w-full",
    "2/3": "w-full md:w-2/3",
    "1/3": "w-full md:w-1/3", 
    "1/2": "w-full md:w-1/2",
    "1/4": "w-full md:w-1/4"
  };

  const variantClasses = {
    default: "bg-[var(--color-bg)] border border-[var(--color-card-border)]",
    subtle: "bg-[var(--color-bg)] border border-[var(--color-card-border)]",
    danger: "bg-[color-mix(in_oklab,var(--color-danger),transparent_96%)] border border-[color-mix(in_oklab,var(--color-danger),transparent_80%)]"
  };

  return (
    <div 
      className={clsx(
        "rounded-md",
        paddingClasses[padding],
        widthClasses[width],
        variantClasses[variant],
        className
      )}
      style={{
        boxShadow: '0 2px 4px 0 var(--color-shadow), 0 1px 2px 0 var(--color-shadow)'
      }}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </div>
  );
}
