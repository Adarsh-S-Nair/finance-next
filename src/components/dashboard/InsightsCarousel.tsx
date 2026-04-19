"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../providers/UserProvider";
import { authFetch } from "../../lib/api/fetch";
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
  const [insights, setInsights] = useState<Insight[]>(mockData?.insights ?? []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(!mockData);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mockData) {
      setInsights(mockData.insights);
      setLoading(false);
      return;
    }
    if (!user?.id) return;
    let cancelled = false;

    authFetch("/api/dashboard/insights")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setInsights(data?.insights || []);
      })
      .catch((err) => {
        if (!cancelled) console.error("[insights] fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, mockData]);

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
      <div className="w-full pl-4 border-l-4 border-[var(--color-border)]">
        <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-border)] mb-4" />
        <div className="space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const current = insights[activeIndex];
  const tone = toneConfig[current.tone];

  return (
    <div className="w-full">
      <div className="relative pl-4">
        {/* Left accent bar — tone-colored, spans full component */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.tone + activeIndex}
            initial={{ opacity: 0, scaleY: 0.6 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${tone.accent}`}
            style={{ originY: 0 }}
          />
        </AnimatePresence>

        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current.id + activeIndex + "-title"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="card-header"
            >
              {current.title}
            </motion.span>
          </AnimatePresence>

          {insights.length > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={goPrev}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
                aria-label="Previous insight"
              >
                <span className="text-sm leading-none">&#8249;</span>
              </button>
              <button
                onClick={goNext}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
                aria-label="Next insight"
              >
                <span className="text-sm leading-none">&#8250;</span>
              </button>
            </div>
          )}
        </div>

        {/* Insight message */}
        <div className="relative overflow-hidden min-h-[44px]">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.p
              key={current.id + activeIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-sm font-medium leading-relaxed text-[var(--color-fg)]"
            >
              {current.message}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress bar — inside the accent area */}
        {insights.length > 1 && (
          <div className="flex items-center gap-1 mt-5">
            {insights.map((_, i) => (
              <div
                key={i}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  i === activeIndex
                    ? "flex-1 bg-[var(--color-fg)]"
                    : "flex-1 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
