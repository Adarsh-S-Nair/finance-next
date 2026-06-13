"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The assistant's dashboard surface. Unlike the flat, monochrome
 * widgets around it, the assistant gets its own immersive panel — a
 * deep violet→navy gradient with a soft overhead bloom — so it reads
 * as a distinct "space" rather than another boxed card. The accent
 * (the brand violet) lives in the surface and the highlights: a live
 * pulse, the index numbers, the count, hover states. Text is fixed
 * light because the panel is always dark in any theme. Links to /today.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */

const ACCENT = "var(--color-neon-purple)";

export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(158deg, #241d3a 0%, #1b2140 55%, #14172a 100%)",
      }}
    >
      {/* Overhead bloom — gives the panel depth, woven into the surface
          rather than sitting on top as a separate decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 right-[-10%] h-48 w-48 rounded-full opacity-45 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(167,139,250,0.55), transparent 70%)",
        }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: ACCENT }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: ACCENT }} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Assistant
          </span>
        </div>
        {decisions.length > 0 && (
          <Link
            href="/today"
            className="text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: ACCENT }}
          >
            {decisions.length} to review
          </Link>
        )}
      </div>

      {decisions.length === 0 ? (
        <p className="relative mt-4 text-sm leading-relaxed text-white/55">
          All clear — nothing needs you. Anything worth a look lands here first.
        </p>
      ) : (
        <div className="relative mt-4 space-y-0.5">
          {decisions.map((item, i) => (
            <Link
              key={item.id}
              href="/today"
              className="group flex gap-3 -mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.06]"
            >
              <span
                className="w-5 shrink-0 pt-px text-[11px] font-semibold tabular-nums"
                style={{ color: ACCENT, opacity: 0.8 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-snug text-white/90 line-clamp-2">
                  {item.headline}
                </span>
                <span className="mt-0.5 block text-[11px] text-white/45">
                  {item.category} · {item.when}
                </span>
              </span>
              <span className="shrink-0 self-center text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="relative mt-4 border-t border-white/10 pt-3.5">
          <Link
            href="/today"
            className="text-xs text-white/50 transition-colors hover:text-white/80"
          >
            Handled {handled.length} {handled.length === 1 ? "thing" : "things"} on its own ›
          </Link>
        </div>
      )}
    </div>
  );
}
