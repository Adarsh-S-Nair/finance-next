"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LuEllipsis,
  LuCheck,
  LuPencil,
  LuArchive,
  LuTrash2,
} from "react-icons/lu";
import { Dropdown } from "@zervo/ui";
import { formatCurrency } from "../../lib/formatCurrency";
import {
  type AllocatedGoal,
  evaluatePace,
  relativeTargetDate,
} from "./types";

type Props = {
  goal: AllocatedGoal;
  isDragging: boolean;
  isDragTarget: boolean;
  /** Index used for stagger delays on mount + arc animation. */
  index?: number;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onEdit: (id: string) => void;
  onComplete: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
};

const GREEN = "#16a34a"; // tailwind emerald-600

// Circle geometry. The SVG viewBox is 100×100 so the math stays clean
// regardless of the rendered ring size. Stroke is 8 (8% of viewBox)
// which reads as a confident thickness without dominating the center.
const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * A goal rendered as a circular progress donut. The arc sweeps from
 * the top of the ring clockwise as money flows in. Underneath the
 * ring sit the name, amount, and a tiny uppercase meta line.
 *
 * Designed to live in a flow grid (2-3 across on desktop, 1 on mobile)
 * — a confident departure from the row-of-progress-bars pattern most
 * budgeting apps use.
 */
export default function GoalRing({
  goal,
  isDragging,
  isDragTarget,
  index = 0,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onEdit,
  onComplete,
  onArchive,
  onDelete,
}: Props) {
  const [hover, setHover] = useState(false);

  const pace = evaluatePace(goal);
  const pct = Math.round(goal.progress * 100);
  const isUnfunded = goal.allocated <= 0;
  const isFull = goal.progress >= 1;
  const clampedProgress = Math.min(1, Math.max(0, goal.progress));

  // Compose the small caps meta line. Keep it terse — the ring carries
  // the visual weight, the meta is just contextual color.
  const metaParts: string[] = [];
  if (goal.isProtected) metaParts.push("Protected");
  if (isFull) {
    metaParts.push("Funded in full");
  } else if (goal.targetDate) {
    metaParts.push(`Due ${relativeTargetDate(goal.targetDate)}`);
    if (pace === "behind") metaParts.push("Behind pace");
    else if (pace === "ahead") metaParts.push("Ahead");
    else if (pace === "on_pace") metaParts.push("On pace");
  } else if (isUnfunded) {
    metaParts.push("Waiting on funds");
  } else {
    metaParts.push("No deadline");
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.06, 0.4),
        duration: 0.35,
        ease: "easeOut",
      }}
      draggable
      onDragStart={(e) => {
        const dt = (e as unknown as DragEvent).dataTransfer;
        if (dt) {
          dt.effectAllowed = "move";
          dt.setData("text/plain", goal.id);
        }
        onDragStart(goal.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        const dt = (e as unknown as DragEvent).dataTransfer;
        if (dt) dt.dropEffect = "move";
        onDragOver(goal.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(goal.id);
      }}
      onDragEnd={() => onDragEnd()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex flex-col items-center py-6 px-4 cursor-grab active:cursor-grabbing"
    >
      {/* Drop-target glow */}
      {isDragTarget && (
        <div
          aria-hidden
          className="absolute inset-2 rounded-2xl bg-[color-mix(in_oklab,var(--color-success),transparent_92%)] pointer-events-none"
        />
      )}

      {/* Actions menu — hover-only, anchored top-right of the tile. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={`Actions for ${goal.name}`}
              className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] rounded"
            >
              <LuEllipsis size={16} />
            </button>
          }
          items={[
            {
              label: "Edit",
              icon: <LuPencil size={14} />,
              onClick: () => onEdit(goal.id),
            },
            {
              label: "Mark complete",
              icon: <LuCheck size={14} />,
              onClick: () => onComplete(goal.id),
            },
            {
              label: "Archive",
              icon: <LuArchive size={14} />,
              onClick: () => onArchive(goal.id),
            },
            ...(goal.isProtected
              ? []
              : [
                  {
                    label: "Delete",
                    icon: <LuTrash2 size={14} />,
                    onClick: () => onDelete(goal.id),
                  },
                ]),
          ]}
        />
      </div>

      {/* The ring itself. SVG so the arc length is exact. */}
      <motion.div
        animate={{ scale: hover ? 1.02 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative"
      >
        <svg
          viewBox="0 0 100 100"
          className="w-36 h-36 -rotate-90"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="color-mix(in oklab, var(--color-fg), transparent 90%)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <motion.circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={GREEN}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{
              strokeDashoffset: CIRCUMFERENCE * (1 - clampedProgress),
            }}
            transition={{
              delay: Math.min(index * 0.06, 0.4) + 0.15,
              duration: 0.9,
              ease: "easeOut",
            }}
            style={{
              filter: isFull ? `drop-shadow(0 0 8px ${GREEN}88)` : undefined,
            }}
          />
        </svg>

        {/* Center label — big percent (or em-dash if untouched) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            className={`text-2xl font-medium tabular-nums leading-none ${
              isFull
                ? "text-emerald-600"
                : isUnfunded
                  ? "text-[var(--color-muted)]"
                  : "text-[var(--color-fg)]"
            }`}
          >
            {isUnfunded ? "—" : `${pct}%`}
          </p>
        </div>
      </motion.div>

      {/* Name + amount below the ring */}
      <div className="mt-4 text-center w-full">
        <p className="text-sm font-medium text-[var(--color-fg)] truncate">
          {goal.name}
        </p>
        <p className="text-xs text-[var(--color-muted)] tabular-nums mt-0.5">
          <span className={isFull ? "text-emerald-600" : "text-[var(--color-fg)]"}>
            {isUnfunded ? "$0" : formatCurrency(goal.allocated)}
          </span>
          <span> / {formatCurrency(goal.target)}</span>
        </p>
        {metaParts.length > 0 && (
          <p
            className={`mt-2 text-[10px] uppercase tracking-[0.14em] truncate ${
              pace === "behind" && !isFull
                ? "text-amber-600 dark:text-amber-500"
                : isFull
                  ? "text-emerald-600"
                  : "text-[var(--color-muted)]"
            }`}
          >
            {metaParts.join(" · ")}
          </p>
        )}
      </div>
    </motion.div>
  );
}
