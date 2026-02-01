"use client";

import React, { ReactNode } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

type HeroProps = {
  /** Icon element to display */
  icon?: ReactNode;
  /** Optional badge overlay on the icon (e.g., sparkle indicator) */
  badge?: ReactNode;
  /** Main headline - use action-oriented text */
  title: string;
  /** Supporting description - focus on benefits */
  description: string;
  /** Primary CTA button */
  action?: ReactNode;
  /** UI preview mockup for split layout */
  preview?: ReactNode;
  /** Layout mode: centered (default) or split with preview */
  layout?: "centered" | "split";
  /** Additional className */
  className?: string;
};

type FeaturesProps = {
  children: ReactNode;
  className?: string;
};

type FeatureProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** Icon accent color (CSS color value) */
  iconColor?: string;
  className?: string;
};

type MockCardProps = {
  /** Accent color for the card elements */
  color?: string;
  /** Progress bar fill percentage (0-100) */
  progressPercent?: number;
  className?: string;
};

// ============================================================================
// EMPTY STATE ROOT
// ============================================================================

function EmptyStateRoot({ children, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={clsx("relative", className)}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// HERO SECTION
// ============================================================================

function Hero({
  icon,
  badge,
  title,
  description,
  action,
  preview,
  layout = "centered",
  className,
}: HeroProps) {
  if (layout === "split" && preview) {
    return (
      <div
        className={clsx(
          "relative flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-16 py-12 lg:py-20",
          className
        )}
      >
        {/* Subtle background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-[0.03] dark:opacity-[0.05]"
            style={{
              background: `radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)`,
            }}
          />
        </div>

        {/* Decorative accent line */}
        <div className="absolute top-0 left-0 w-16 h-1 bg-gradient-to-r from-[var(--color-accent)] to-transparent rounded-full" />

        {/* Left side - Copy */}
        <div className="relative flex-1 max-w-xs">
          {icon && (
            <div className="relative mb-6 w-fit">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 flex items-center justify-center">
                <div className="text-[var(--color-accent)] [&>svg]:w-7 [&>svg]:h-7">
                  {icon}
                </div>
              </div>
              {badge && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white [&>svg]:w-3 [&>svg]:h-3">
                  {badge}
                </div>
              )}
            </div>
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold text-[var(--color-fg)] mb-4 tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-base text-[var(--color-muted)] mb-8 leading-relaxed">
            {description}
          </p>
          {action}
        </div>

        {/* Right side - Preview */}
        <div className="relative flex-1 w-full lg:w-auto">{preview}</div>
      </div>
    );
  }

  // Centered layout
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-16 lg:py-20",
        className
      )}
    >
      {icon && (
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 flex items-center justify-center">
            <div className="text-[var(--color-accent)] [&>svg]:w-10 [&>svg]:h-10">
              {icon}
            </div>
          </div>
          {badge && (
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white [&>svg]:w-4 [&>svg]:h-4">
              {badge}
            </div>
          )}
        </div>
      )}

      <h2 className="text-2xl font-semibold text-[var(--color-fg)] mb-2 text-center">
        {title}
      </h2>
      <p className="text-[var(--color-muted)] text-center max-w-md mb-8">
        {description}
      </p>
      {action}
    </div>
  );
}

// ============================================================================
// FEATURES GRID
// ============================================================================

function Features({ children, className }: FeaturesProps) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// SINGLE FEATURE CARD
// ============================================================================

function Feature({
  icon,
  title,
  description,
  iconColor = "var(--color-accent)",
  className,
}: FeatureProps) {
  return (
    <div className={clsx("text-center", className)}>
      <div
        className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-3"
        style={{ color: iconColor }}
      >
        <div className="[&>svg]:w-5 [&>svg]:h-5">{icon}</div>
      </div>
      <h3 className="text-sm font-medium text-[var(--color-fg)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

// ============================================================================
// PREVIEW WRAPPER (with fade overlay)
// ============================================================================

type PreviewProps = {
  children: ReactNode;
  className?: string;
};

function Preview({ children, className }: PreviewProps) {
  return (
    <div className={clsx("relative", className)}>
      {/* Fade overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-bg)] pointer-events-none z-10" />
      <div className="space-y-4 opacity-60">{children}</div>
    </div>
  );
}

// ============================================================================
// MOCK CARD (for preview skeletons)
// ============================================================================

function MockCard({
  color = "var(--color-accent)",
  progressPercent = 60,
  className,
}: MockCardProps) {
  return (
    <div
      className={clsx(
        "bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)]",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in oklab, ${color}, transparent 90%)` }}
          >
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: `color-mix(in oklab, ${color}, transparent 60%)` }}
            />
          </div>
          <div>
            <div className="h-4 w-24 bg-[var(--color-muted)]/20 rounded" />
          </div>
        </div>
        <div className="h-4 w-16 bg-[var(--color-muted)]/20 rounded" />
      </div>
      <div className="h-2 w-full bg-[var(--color-muted)]/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: `color-mix(in oklab, ${color}, transparent 60%)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <div className="h-3 w-12 bg-[var(--color-muted)]/15 rounded" />
        <div className="h-3 w-12 bg-[var(--color-muted)]/15 rounded" />
      </div>
    </div>
  );
}

// ============================================================================
// COMPOUND COMPONENT EXPORT
// ============================================================================

export const EmptyState = Object.assign(EmptyStateRoot, {
  Hero,
  Features,
  Feature,
  Preview,
  MockCard,
});

export default EmptyState;
