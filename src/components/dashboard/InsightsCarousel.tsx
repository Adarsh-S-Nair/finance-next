"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../providers/UserProvider";
import { authFetch } from "../../lib/api/fetch";
import type { Insight } from "../../lib/insights/types";

const ROTATE_INTERVAL = 8000;

const toneIcon: Record<string, string> = {
  positive: "▲",
  negative: "▼",
  neutral: "●",
};

const toneColor: Record<string, string> = {
  positive: "text-emerald-500",
  negative: "text-rose-500",
  neutral: "text-[var(--color-muted)]",
};

export default function InsightsCarousel() {
  const { user } = useUser();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      <div className="w-full">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-border)] mb-4" />
        <div className="space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const current = insights[activeIndex];

  return (
    <div className="w-full">
      {/* Header with nav */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header">Insights</h3>

        {insights.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums mr-1.5">
              {activeIndex + 1}/{insights.length}
            </span>
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

      {/* Insight content */}
      <div className="relative overflow-hidden min-h-[40px]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={current.id + activeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-start gap-2.5"
          >
            <span className={`text-[10px] mt-[3px] flex-shrink-0 ${toneColor[current.tone]}`}>
              {toneIcon[current.tone]}
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--color-fg)]">
              {current.message}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      {insights.length > 1 && (
        <div className="flex items-center gap-1 mt-4">
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
  );
}
