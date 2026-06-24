"use client";

/**
 * Shared interactive donut. Lifted out of TopCategoriesCard so the
 * agent's portfolio breakdown widget can render the same surface — same
 * d3.arc paths, same hover bump, same center number swap. Anywhere we
 * want "categorical breakdown as a donut", use this.
 *
 * Controlled by `hoveredId` + `onHover` so the caller can cross-
 * highlight a side legend, persist hover state during external
 * re-renders, etc. Pass `null` and a no-op if you don't need that.
 */
import { useEffect, useRef, useState } from "react";
import { arc as d3arc } from "d3-shape";
import { CurrencyAmount } from "../lib/formatCurrency";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Marks this segment as the rolled-up "Other" bucket so the click
   *  handler can branch on it without us needing to special-case the id
   *  string. */
  isOther?: boolean;
  /** Original ids of categories rolled into "Other". Useful when the
   *  consumer wants to drill into them on click. */
  otherIds?: string[];
}

export interface InteractiveDonutProps {
  segments: DonutSegment[];
  total: number;
  /** Center label when nothing is hovered (e.g. "This Month",
   *  "By asset class"). */
  centerLabel: string;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onClick?: (seg: DonutSegment) => void;
  /** Outer diameter in px. Default 220 matches the dashboard. */
  size?: number;
  /** Ring thickness in px. */
  strokeWidth?: number;
  /** Small text appended after the percentage on hover, e.g.
   *  "of spending", "of portfolio". When omitted, hovering just shows
   *  the bare percentage like "47%". */
  pctSuffix?: string;
}

// Defaults pulled from TopCategoriesCard so the donut on the dashboard
// stays pixel-identical after the extraction.
const DEFAULT_SIZE = 220;
const DEFAULT_STROKE = 16;
const SLICE_CORNER_RADIUS = 2;
const SEGMENT_GAP_PX = 4;
// Duration of the data-change tween (e.g. flexible ↔ total). Slices
// re-proportion, grow in, or shrink out over this window.
const ANIM_DURATION_MS = 450;

// Snapshot of just the fields the tween interpolates / carries forward.
type AnimState = { list: DonutSegment[]; total: number };

// easeInOutCubic — gentle accelerate/decelerate so the re-proportioning
// reads as deliberate rather than linear/mechanical.
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type RenderedSegment = DonutSegment & {
  /** SVG path string for this slice (annular sector with rounded corners). */
  path: string;
  /** Same slice rendered with the hover-expanded outer radius. */
  hoverPath: string;
  pct: number;
};

// Segmented donut with a small arc gap between slices. Rendered as filled
// `<path>`s via d3.arc rather than stroked circles with dasharray — that
// gives us per-slice cornerRadius (slightly rounded ends, not pill caps)
// and a true angular gap that doesn't bleed across slices.
export default function InteractiveDonut({
  segments,
  total,
  centerLabel,
  hoveredId,
  onHover,
  onClick,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
  pctSuffix,
}: InteractiveDonutProps) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius - strokeWidth;
  // Hovered slices grow outward by 2px on each side (4px total visual
  // bump) — same emphasis as the prior strokeWidth +4.
  const hoverOuterRadius = outerRadius + 2;
  const hoverInnerRadius = innerRadius - 2;
  const midRadius = (outerRadius + innerRadius) / 2;

  // ── Data-change tween ───────────────────────────────────────────────
  // We render from an animated `display` snapshot, not the raw props, so a
  // dataset swap (flexible ↔ total, a budget edit, a month change) eases
  // between shapes. We interpolate each slice's VALUE and recompute real
  // arcs every frame — never CSS-morph the path `d` between unrelated
  // shapes, which is what made slices balloon and spin. Because every
  // slice (incl. "Other") sums to `total`, the interpolated values always
  // sum to the interpolated total, so the ring stays exactly full mid-tween.
  const [display, setDisplay] = useState<AnimState>(() => ({
    list: segments,
    total,
  }));
  const [isAnimating, setIsAnimating] = useState(false);
  const displayRef = useRef<AnimState>(display);
  // Keep the ref pointed at the latest committed display so a freshly-starting
  // tween eases from whatever is on screen (incl. mid-flight). This effect is
  // declared before the tween effect, so on a data-change commit it runs first
  // and the ref is current when the tween reads it.
  useEffect(() => {
    displayRef.current = display;
  }, [display]);
  const rafRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  // Signature of the incoming data shape — drives the tween only when the
  // actual values/ids/total change (not on every re-render).
  const targetSignature =
    segments.map((s) => `${s.id}:${s.value}`).join("|") + `|${total}`;

  useEffect(() => {
    // Skip the tween on first mount — `display` is already seeded from props
    // via useState, so the initial donut paints instantly (only intentional
    // swaps animate, never page load).
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    const target: AnimState = { list: segments, total };
    const from = displayRef.current;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    // Union of ids (target order first, then any exiting slices) so entering
    // slices grow from 0 and exiting ones shrink to 0 in a stable position.
    const fromMap = new Map(from.list.map((s) => [s.id, s]));
    const toMap = new Map(target.list.map((s) => [s.id, s]));
    const order: string[] = [];
    const seen = new Set<string>();
    for (const s of target.list) {
      order.push(s.id);
      seen.add(s.id);
    }
    for (const s of from.list) {
      if (!seen.has(s.id)) {
        order.push(s.id);
        seen.add(s.id);
      }
    }

    setIsAnimating(true);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_DURATION_MS);
      const e = easeInOut(t);
      const list: DonutSegment[] = order.map((id) => {
        const a = fromMap.get(id);
        const b = toMap.get(id);
        const meta = (b ?? a) as DonutSegment;
        const av = a?.value ?? 0;
        const bv = b?.value ?? 0;
        return { ...meta, value: av + (bv - av) * e };
      });
      const tween = from.total + (target.total - from.total) * e;
      setDisplay({ list, total: tween });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // Land exactly on the target so exiting slices drop out of the DOM.
        setDisplay(target);
        setIsAnimating(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSignature]);

  // padAngle wants radians; convert from the user-facing pixel gap by
  // dividing by the mid-radius (length of arc at that radius / radius
  // = angle in radians). Skip the gap when there's only one segment so
  // a single full-circle ring doesn't get a visible notch.
  const padAngle = display.list.length > 1 ? SEGMENT_GAP_PX / midRadius : 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Track the most recent pointer type so we can distinguish a real mouse
  // click from a touch tap. On touch, a single tap should reveal the
  // segment's info (like a desktop hover); a second tap on the same
  // segment then navigates.
  const lastPointerTypeRef = useRef<string>("mouse");
  // Defer clearing hover by a frame so moving between adjacent slices
  // doesn't cause a flicker — the incoming slice's mouseenter cancels
  // the pending clear.
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClear = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  };
  const scheduleClear = () => {
    if (clearTimerRef.current) return;
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null;
      onHover(null);
    }, 30);
  };

  useEffect(() => () => cancelClear(), []);

  // Dismiss the touch-revealed tooltip when the user taps outside the donut.
  useEffect(() => {
    if (!hoveredId) return;
    const handleOutside = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const target = e.target as Node | null;
      if (!target || !containerRef.current?.contains(target)) {
        onHover(null);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [hoveredId, onHover]);

  const arcGen = d3arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(SLICE_CORNER_RADIUS)
    .padAngle(padAngle);
  const arcGenHover = d3arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(hoverInnerRadius)
    .outerRadius(hoverOuterRadius)
    .cornerRadius(SLICE_CORNER_RADIUS)
    .padAngle(padAngle);

  // Build the arcs from the animated `display` snapshot. During a tween this
  // runs every frame with eased values; at rest it's just the props verbatim.
  // Near-zero slices (entering/exiting) collapse to an empty path so d3.arc's
  // padAngle doesn't render a stub.
  const rendered: RenderedSegment[] = [];
  display.list.reduce((cumulative, seg) => {
    const pct = display.total > 0 ? seg.value / display.total : 0;
    const angle = pct * 2 * Math.PI;
    const startAngle = cumulative;
    const endAngle = cumulative + angle;
    const visible = angle > 1e-4;
    rendered.push({
      ...seg,
      path: visible ? (arcGen({ startAngle, endAngle }) ?? "") : "",
      hoverPath: visible ? (arcGenHover({ startAngle, endAngle }) ?? "") : "",
      pct,
    });
    return endAngle;
  }, 0);

  const hovered = hoveredId
    ? (rendered.find((r) => r.id === hoveredId) ?? null)
    : null;

  // Center number reads the eased total so it counts up/down with the ring.
  const centerAmount = hovered ? hovered.value : display.total;
  const centerLabelText = hovered ? hovered.label : centerLabel;
  const centerPct = hovered ? Math.round(hovered.pct * 100) : null;

  const handleSegmentClick = (seg: RenderedSegment) => {
    const isTouch = lastPointerTypeRef.current === "touch";
    // On touch, first tap only reveals info. A subsequent tap on the
    // already-revealed segment navigates.
    if (isTouch && hoveredId !== seg.id) {
      onHover(seg.id);
      return;
    }
    onClick?.(seg);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* d3.arc generates paths centered on (0, 0) starting at the
            12 o'clock position, growing clockwise — so we translate to
            the donut center and the angles map naturally. No -rotate-90
            needed. */}
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {rendered.map((seg) => {
            const isHovered = hoveredId === seg.id;
            const dimmed = hoveredId && !isHovered;
            return (
              <path
                key={seg.id}
                d={isHovered ? seg.hoverPath : seg.path}
                fill={seg.color}
                style={{
                  opacity: dimmed ? 0.4 : 1,
                  cursor: onClick ? "pointer" : "default",
                  // CSS-transition `d` only for the idle hover bump. During a
                  // data tween the rAF loop already rewrites `d` every frame —
                  // a CSS `d` transition would lag and fight it — so drop it.
                  transition: isAnimating
                    ? "opacity 0.15s ease"
                    : "opacity 0.15s ease, d 0.15s ease",
                }}
                onPointerDown={(e) => {
                  lastPointerTypeRef.current = e.pointerType || "mouse";
                }}
                onMouseEnter={() => {
                  if (lastPointerTypeRef.current === "touch") return;
                  cancelClear();
                  onHover(seg.id);
                }}
                onMouseLeave={() => {
                  if (lastPointerTypeRef.current === "touch") return;
                  scheduleClear();
                }}
                onClick={() => handleSegmentClick(seg)}
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
        <div className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider truncate max-w-full">
          {centerLabelText}
        </div>
        <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums leading-tight mt-1">
          <CurrencyAmount amount={centerAmount} />
        </div>
        {centerPct !== null && (
          <div className="text-[11px] tabular-nums text-[var(--color-muted)] mt-0.5">
            {centerPct}%{pctSuffix ? ` ${pctSuffix}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
