"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import type { Insight } from "../../lib/insights/types";

const ROTATE_INTERVAL = 8000;

const toneConfig = {
  positive: {
    accent: "bg-emerald-500",
  },
  negative: {
    accent: "bg-rose-500",
  },
  neutral: {
    accent: "bg-[var(--color-muted)]",
  },
};

export interface InsightsMock {
  insights: Insight[];
}

interface InsightsCarouselProps {
  mockData?: InsightsMock;
}

export default function InsightsCarousel({ mockData }: InsightsCarouselProps = {}) {
  const { user } = useUser();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cached via react-query so navigating away and back to the
  // dashboard paints the insights from cache instead of re-fetching.
  const { data, isLoading } = useAuthedQuery<{ insights: Insight[] }>(
    ["dashboard-insights", user?.id],
    user?.id && !mockData ? "/api/dashboard/insights" : null,
  );

  // Unmatched transfers used to live in the notifications bell, but
  // they're more of a "here's something worth looking at" than a
  // time-critical notification. Fetched here so we can prepend a
  // synthetic insight pointing the user at the filtered transactions
  // list when there's anything to review.
  const { data: countsData } = useAuthedQuery<{ unmatchedTransferCount: number }>(
    ["transactions-attention-count", user?.id],
    user?.id && !mockData ? "/api/plaid/transactions/unknown-count" : null,
  );

  const insights = useMemo<Insight[]>(() => {
    const base = mockData?.insights ?? data?.insights ?? [];
    const unmatched = countsData?.unmatchedTransferCount ?? 0;
    if (mockData || unmatched <= 0) return base;
    const synthetic: Insight = {
      id: "unmatched-transfers",
      title: "Worth a look",
      priority: 900,
      tone: "negative",
      message:
        unmatched === 1
          ? "There's 1 unmatched transfer waiting for review."
          : `There are ${unmatched} unmatched transfers waiting for review.`,
      action: { label: "Review", href: "/transactions?status=attention" },
    };
    // Put it at the front so the user sees it first on load.
    return [synthetic, ...base];
  }, [mockData, data?.insights, countsData?.unmatchedTransferCount]);
  const loading = mockData ? false : isLoading;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (insights.length <= 1) return;
    timerRef.current = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % insights.length);
    }, ROTATE_INTERVAL);
  }, [insights.length]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const goNext = () => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % insights.length);
    resetTimer();
  };

  const goPrev = () => {
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + insights.length) % insights.length);
    resetTimer();
  };

  if (loading) {
    return (
      <div className="w-full bg-[var(--color-surface-alt)] p-5 relative">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-border)]" />
        <div className="pl-3">
          <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-border)] mb-4" />
          <div className="space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded bg-[var(--color-border)]" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const current = insights[activeIndex];
  const tone = toneConfig[current.tone];

  return (
    <div className="w-full">
      <div className="relative p-5 overflow-hidden bg-[var(--color-surface-alt)]">
        {/* Left accent bar — tone-colored, snappy spring-in, spans full height */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.tone + activeIndex}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{
              scaleY: { duration: 0.22, ease: [0.16, 1.4, 0.3, 1] },
              opacity: { duration: 0.1, ease: "easeOut" },
            }}
            className={`absolute left-0 top-0 bottom-0 w-[3px] ${tone.accent}`}
            style={{ originY: 0.5 }}
          />
        </AnimatePresence>

        <div className="pl-3">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={current.id + activeIndex + "-title"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="card-header"
              >
                {current.title}
              </motion.span>
            </AnimatePresence>

            {insights.length > 1 && (
              <div className="flex items-center gap-0.5 -mr-1">
                <button
                  onClick={goPrev}
                  className="w-6 h-6 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] transition-colors"
                  aria-label="Previous insight"
                >
                  <span className="text-sm leading-none">&#8249;</span>
                </button>
                <button
                  onClick={goNext}
                  className="w-6 h-6 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] transition-colors"
                  aria-label="Next insight"
                >
                  <span className="text-sm leading-none">&#8250;</span>
                </button>
              </div>
            )}
          </div>

          {/* Insight message — animate message + optional CTA as one
              unit so they slide in together. */}
          <div className="relative overflow-hidden min-h-[44px]">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current.id + activeIndex}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-start justify-between gap-3"
              >
                <p className="text-sm font-medium leading-relaxed text-[var(--color-fg)] flex-1 min-w-0">
                  {current.message}
                </p>
                {current.action && (
                  <Link
                    href={current.action.href}
                    className="inline-flex items-center h-7 px-3 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] text-xs font-medium whitespace-nowrap transition-opacity hover:opacity-90 flex-shrink-0"
                  >
                    {current.action.label}
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          {insights.length > 1 && (
            <div className="flex items-center gap-1 mt-4">
              {insights.map((_, i) => (
                <div
                  key={i}
                  className={`h-[3px] transition-all duration-500 ${
                    i === activeIndex
                      ? "flex-1 bg-[var(--color-fg)]"
                      : "flex-1 bg-[var(--color-fg)]/[0.15]"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
