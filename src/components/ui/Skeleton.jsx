"use client";

import clsx from "clsx";

export default function Skeleton({ className, variant = "default", ...props }) {
  const baseClasses = "animate-pulse bg-[var(--color-border)]";
  
  const variants = {
    default: baseClasses,
    text: clsx(baseClasses, "h-4 rounded"),
    title: clsx(baseClasses, "h-6 rounded"),
    avatar: clsx(baseClasses, "rounded-full"),
    card: clsx(baseClasses, "rounded-lg"),
    button: clsx(baseClasses, "h-10 rounded-lg"),
    line: clsx(baseClasses, "h-px"),
  };

  return (
    <div
      className={clsx(variants[variant] || variants.default, className)}
      {...props}
    />
  );
}

// Card Skeleton Component
export function CardSkeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        "border border-[var(--color-border)] rounded-lg bg-[var(--color-content-bg)] p-6",
        className
      )}
      {...props}
    >
      <Skeleton variant="title" className="w-1/3 h-5 mb-4" />
      <Skeleton variant="text" className="w-full mb-2" />
      <Skeleton variant="text" className="w-3/4" />
    </div>
  );
}

// Portfolio Card Skeleton
export function PortfolioCardSkeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        "border border-[var(--color-border)] rounded-lg bg-[var(--color-content-bg)] p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="title" className="w-32 h-4" />
        <Skeleton variant="avatar" className="w-8 h-8" />
      </div>
      <Skeleton variant="title" className="w-24 h-6 mb-2" />
      <Skeleton variant="text" className="w-20 h-4 mb-4" />
      <div className="h-24 mb-4">
        <Skeleton variant="card" className="w-full h-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="text" className="flex-1 h-3" />
        <Skeleton variant="text" className="flex-1 h-3" />
      </div>
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        "border border-[var(--color-border)] rounded-lg bg-[var(--color-content-bg)] p-6",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant="title" className="w-40 h-5" />
        <Skeleton variant="button" className="w-24 h-8" />
      </div>
      <Skeleton variant="card" className="w-full h-64 mb-4" />
      <div className="flex gap-4">
        <Skeleton variant="text" className="w-32 h-4" />
        <Skeleton variant="text" className="w-32 h-4" />
        <Skeleton variant="text" className="w-32 h-4" />
      </div>
    </div>
  );
}

// Holdings Table Skeleton
export function HoldingsTableSkeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        "border border-[var(--color-border)] rounded-lg bg-[var(--color-content-bg)]",
        className
      )}
      {...props}
    >
      <div className="p-4 border-b border-[var(--color-border)]">
        <Skeleton variant="title" className="w-32 h-5" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton variant="avatar" className="w-10 h-10" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-24 h-4" />
              <Skeleton variant="text" className="w-16 h-3" />
            </div>
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton variant="text" className="w-20 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Generic List Skeleton
export function ListSkeleton({ items = 3, className, ...props }) {
  return (
    <div className={clsx("space-y-3", className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="avatar" className="w-10 h-10" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4 h-4" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

