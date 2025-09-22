"use client";

import React, { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  variant?: "default" | "subtle" | "danger";
  width?: "full" | "2/3" | "1/3" | "1/2" | "1/4";
};

export default function Card({ 
  children, 
  className, 
  padding = "md",
  variant = "default",
  width = "full"
}: CardProps) {
  const paddingClasses = {
    sm: "p-3",
    md: "p-4", 
    lg: "p-6"
  };

  const widthClasses = {
    full: "w-full",
    "2/3": "w-full sm:w-2/3",
    "1/3": "w-full sm:w-1/3", 
    "1/2": "w-full sm:w-1/2",
    "1/4": "w-full sm:w-1/4"
  };

  const variantClasses = {
    default: "border-[var(--color-border)] bg-[var(--color-bg)]",
    subtle: "border-[var(--color-border)] bg-[var(--color-bg)]",
    danger: "border-[color-mix(in_oklab,var(--color-danger),transparent_80%)] bg-[color-mix(in_oklab,var(--color-danger),transparent_96%)]"
  };

  return (
    <div 
      className={clsx(
        "rounded-md border",
        paddingClasses[padding],
        widthClasses[width],
        variantClasses[variant],
        className
      )}
      style={{
        boxShadow: '0 1px 3px 0 var(--color-shadow)'
      }}
    >
      {children}
    </div>
  );
}
