"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LuSparkles, LuArrowRight } from "react-icons/lu";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The assistant's presence on the dashboard — the one surface that's
 * allowed a little flair, since it's the product's signature feature.
 * It borrows the AI brand vocabulary from the agent input (the neon
 * gradient + soft glow): a gradient sparkle badge, a faint corner
 * bloom, a staggered entrance, and amber glow-dots on the things that
 * need a decision. Everything still links into /today.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */

const AI_GRADIENT =
  "linear-gradient(135deg, var(--color-neon-purple), var(--color-neon-blue))";

export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-[var(--color-surface-alt)] p-5">
      {/* Soft neon bloom in the corner — the AI brand glow, very low key */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-30 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-neon-purple), transparent 70%)",
        }}
      />

      <div className="relative flex items-center gap-2.5">
        <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg">
          <span aria-hidden className="absolute inset-0" style={{ background: AI_GRADIENT }} />
          <LuSparkles className="relative h-4 w-4 text-white" strokeWidth={2.5} />
        </span>
        <span className="card-header !text-[var(--color-fg)]">Assistant</span>
        {decisions.length > 0 && (
          <span
            className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
            style={{ background: AI_GRADIENT }}
          >
            {decisions.length}
          </span>
        )}
      </div>

      {decisions.length === 0 ? (
        <p className="relative mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          All clear — I went through your week and nothing needs you. I&apos;ll
          flag anything worth a look right here.
        </p>
      ) : (
        <>
          <p className="relative mt-3 text-sm leading-relaxed text-[var(--color-fg)]">
            I went through your week — here&apos;s what could use your call:
          </p>

          <div className="relative mt-3 space-y-px">
            {decisions.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href="/today"
                  className="group flex items-center gap-2.5 -mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--color-fg)]/[0.04]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    style={{ boxShadow: "0 0 6px var(--color-warn)" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-fg)]/90 transition-colors group-hover:text-[var(--color-fg)]">
                    {item.headline}
                  </span>
                  <LuArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--color-muted)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {handled.length > 0 && (
        <Link
          href="/today"
          className="group relative mt-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <span className="text-emerald-500">✓</span>
          I also handled {handled.length} {handled.length === 1 ? "thing" : "things"} on my own
          <LuArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </Link>
      )}
    </div>
  );
}
