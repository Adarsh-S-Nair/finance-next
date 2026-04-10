"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../providers/UserProvider";
import { authFetch } from "../../lib/api/fetch";
import type { Insight } from "../../lib/insights/types";

const ROTATE_INTERVAL = 8000; // ms between auto-advance

const toneConfig = {
  positive: {
    dot: "bg-emerald-500",
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/8 dark:bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  negative: {
    dot: "bg-rose-500",
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/8 dark:bg-rose-500/10",
    border: "border-rose-500/20",
  },
  neutral: {
    dot: "bg-blue-500",
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    border: "border-blue-500/20",
  },
};

const toneLabel = {
  positive: "Looking good",
  negative: "Heads up",
  neutral: "FYI",
};

export default function InsightsCarousel() {
  const { user } = useUser();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch insights
  useEffect(() => {
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
  }, [user?.id]);

  // Auto-rotate
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

  const goTo = (index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    resetTimer();
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-3">
          <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] p-4">
          <div className="h-2.5 w-12 animate-pulse rounded bg-[var(--color-border)] mb-2.5" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--color-border)] mb-1.5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
      </div>
    );
  }

  // Don't render if no insights
  if (insights.length === 0) return null;

  const current = insights[activeIndex];
  const tone = toneConfig[current.tone];

  return (
    <div className="w-full">
      <h3 className="card-header mb-3">Insights</h3>

      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] ">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={current.id + activeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="p-4"
          >
            {/* Tone label */}
            <span
              className={`inline-block text-[10px] font-semibold uppercase tracking-wider mb-2 ${tone.accent}`}
            >
              {toneLabel[current.tone]}
            </span>

            {/* Insight message */}
            <p className="text-[13px] leading-relaxed text-[var(--color-fg)]">
              {current.message}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dots navigation */}
        {insights.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {insights.map((insight, i) => (
              <button
                key={insight.id}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? `w-4 h-1.5 ${toneConfig[insight.tone].dot}`
                    : "w-1.5 h-1.5 bg-[var(--color-border)] hover:bg-[var(--color-muted)]"
                }`}
                aria-label={`Go to insight ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
