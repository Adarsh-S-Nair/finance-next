"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LuChevronRight,
  LuGripVertical,
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
  type Pace,
  evaluatePace,
  relativeTargetDate,
} from "./types";

type Props = {
  goal: AllocatedGoal;
  isDragging: boolean;
  isDragTarget: boolean;
  /** Index in the list — used to stagger the entrance animation. */
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

const GREEN_FILL = "#16a34a"; // tailwind emerald-600

/**
 * Editorial-style goal row. No card, no border, no icons — just large
 * typography on the page background with a thin progress underline.
 * The drag handle and actions menu are hover-only and live in the
 * row's outer margin so they don't compete with the type.
 */
export default function GoalRow({
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
  const [expanded, setExpanded] = useState(false);

  const pace = evaluatePace(goal);
  const hasLineItems = goal.lineItems.length > 0;
  const pct = Math.round(goal.progress * 100);
  const isUnfunded = goal.allocated <= 0;
  const isFull = goal.progress >= 1;
  const fillPct = Math.min(100, Math.max(0, goal.progress * 100));

  // Compose the muted meta line. Order: protection → deadline → pace →
  // line-item count → fallback. Use middle-dots for separators.
  const metaParts: string[] = [];
  if (goal.isProtected) metaParts.push("Protected");
  if (goal.targetDate) metaParts.push(`Due ${relativeTargetDate(goal.targetDate)}`);
  if (goal.targetDate && pace !== "no_date" && pace !== "complete") {
    if (pace === "behind") metaParts.push("Behind pace");
    else if (pace === "ahead") metaParts.push("Ahead of pace");
    else if (pace === "on_pace") metaParts.push("On pace");
    else if (pace === "unfunded") metaParts.push("Not yet funded");
  }
  if (hasLineItems) {
    metaParts.push(`${goal.lineItems.length} ${goal.lineItems.length === 1 ? "item" : "items"}`);
  }
  if (!goal.targetDate && !goal.isProtected && !hasLineItems) {
    metaParts.push(isUnfunded ? "Waiting on funds" : "No deadline");
  }
  if (isFull && !metaParts.includes("Funded in full")) {
    // Replace the trailing "no deadline" / pace tag with a celebratory one.
    metaParts.length = 0;
    if (goal.isProtected) metaParts.push("Protected");
    metaParts.push("Funded in full");
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.05, 0.4),
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
      className={`group relative ${isDragTarget ? "rounded-lg" : ""}`}
    >
      {/* Drop-target wash. Sits behind the type, very subtle. */}
      {isDragTarget && (
        <div
          aria-hidden
          className="absolute -inset-x-3 -inset-y-2 rounded-xl bg-[color-mix(in_oklab,var(--color-success),transparent_92%)] pointer-events-none"
        />
      )}

      {/* Drag handle — sits in the left margin so it doesn't push the
          type around. Visible on hover. */}
      <button
        type="button"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-7 -translate-x-7 text-[var(--color-muted)] opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-opacity hidden md:block"
      >
        <LuGripVertical size={14} />
      </button>

      <div
        className="relative py-6"
        onClick={() => hasLineItems && setExpanded((v) => !v)}
        style={{ cursor: hasLineItems ? "pointer" : "default" }}
      >
        {/* Title + amount + actions. */}
        <div className="flex items-baseline justify-between gap-6">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[22px] sm:text-[26px] font-medium tracking-tight text-[var(--color-fg)] leading-tight truncate">
              {goal.name}
            </h3>
            {hasLineItems && (
              <motion.span
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-[var(--color-muted)] flex-shrink-0"
              >
                <LuChevronRight size={16} />
              </motion.span>
            )}
          </div>

          <div className="flex items-baseline gap-2 flex-shrink-0">
            <p className="text-[22px] sm:text-[26px] font-medium tracking-tight tabular-nums leading-tight whitespace-nowrap">
              <span
                className={
                  isFull
                    ? "text-emerald-600"
                    : isUnfunded
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-fg)]"
                }
              >
                {isUnfunded ? "—" : formatCurrency(goal.allocated)}
              </span>
              <span className="text-[var(--color-muted)] text-sm font-normal">
                {" "}/ {formatCurrency(goal.target)}
              </span>
            </p>

            {/* Actions — hover-reveal, sits flush with the amount. */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Dropdown
                trigger={
                  <button
                    type="button"
                    aria-label={`Actions for ${goal.name}`}
                    className="p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] rounded"
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
          </div>
        </div>

        {/* Meta line below the title — tiny caps, muted. */}
        <div className="mt-2 flex items-baseline justify-between gap-4 text-[10px] uppercase tracking-[0.14em]">
          <p
            className={`truncate ${
              isFull
                ? "text-emerald-600"
                : pace === "behind"
                  ? "text-amber-600 dark:text-amber-500"
                  : "text-[var(--color-muted)]"
            }`}
          >
            {metaParts.join(" · ")}
          </p>
          <p className="text-[var(--color-muted)] tabular-nums flex-shrink-0">
            {isUnfunded ? "0%" : `${pct}%`}
          </p>
        </div>

        {/* Thin progress underline. 2px, green, animates in from 0. */}
        <div className="mt-4 h-[2px] w-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{
              delay: Math.min(index * 0.05, 0.4) + 0.15,
              duration: 0.8,
              ease: "easeOut",
            }}
            className="h-full rounded-full"
            style={{
              backgroundColor: GREEN_FILL,
              boxShadow: isFull ? `0 0 10px ${GREEN_FILL}55` : undefined,
            }}
          />
        </div>

        {/* Expandable line items. Indented text list with their own
            mini progress underlines. */}
        <AnimatePresence initial={false}>
          {expanded && hasLineItems && (
            <motion.div
              key="line-items"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="pt-6 pl-6 space-y-5">
                {goal.lineItems.map((li, idx) => {
                  const consumedBefore = goal.lineItems
                    .slice(0, idx)
                    .reduce((s, x) => s + x.target, 0);
                  const itemAllocated = Math.max(
                    0,
                    Math.min(li.target, goal.allocated - consumedBefore),
                  );
                  const itemPct =
                    li.target > 0 ? (itemAllocated / li.target) * 100 : 0;
                  return (
                    <div key={li.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-[var(--color-fg)] truncate">
                          {li.name}
                        </span>
                        <span className="text-sm tabular-nums whitespace-nowrap">
                          <span className="text-[var(--color-fg)]">
                            {formatCurrency(itemAllocated)}
                          </span>
                          <span className="text-[var(--color-muted)] text-xs">
                            {" "}/ {formatCurrency(li.target)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 h-px w-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden rounded-full">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, itemPct)}%` }}
                          transition={{
                            delay: 0.05 + idx * 0.05,
                            duration: 0.55,
                            ease: "easeOut",
                          }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: GREEN_FILL }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// PaceTag was previously inlined into the meta line; deprecated and
// removed in favor of the metaParts join above.
export type { Pace };
