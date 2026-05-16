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
 * Goal row — no card chrome, no icons. Just a heading, an amount, a
 * thick green progress bar, and a tiny caps meta line. Rows separate
 * with a hairline divider supplied by the parent list (`divide-y`).
 * Drag-and-actions affordances reveal on hover.
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

  // Compose the muted caps meta line.
  const metaParts: string[] = [];
  if (goal.isProtected) metaParts.push("Protected");
  if (isFull) {
    metaParts.push("Funded in full");
  } else if (goal.targetDate) {
    metaParts.push(`Due ${relativeTargetDate(goal.targetDate)}`);
    if (pace === "behind") metaParts.push("Behind pace");
    else if (pace === "ahead") metaParts.push("Ahead");
    else if (pace === "on_pace") metaParts.push("On pace");
  } else if (isUnfunded && !goal.isProtected) {
    metaParts.push("Waiting on funds");
  } else if (!goal.isProtected) {
    metaParts.push("No deadline");
  }
  if (hasLineItems) {
    metaParts.push(
      `${goal.lineItems.length} ${goal.lineItems.length === 1 ? "item" : "items"}`,
    );
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
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
      className="group relative"
    >
      {/* Drop-target wash — full bleed, very subtle. */}
      {isDragTarget && (
        <div
          aria-hidden
          className="absolute -inset-x-3 inset-y-0 rounded-lg bg-[color-mix(in_oklab,var(--color-success),transparent_93%)] pointer-events-none"
        />
      )}

      {/* Drag handle in the left margin. Hover-only. */}
      <button
        type="button"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-5 -translate-x-7 text-[var(--color-muted)] opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-opacity hidden md:block"
      >
        <LuGripVertical size={14} />
      </button>

      <div
        className="relative py-5"
        onClick={() => hasLineItems && setExpanded((v) => !v)}
        style={{ cursor: hasLineItems ? "pointer" : "default" }}
      >
        {/* Name + amount + actions */}
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-fg)] truncate">
              {goal.name}
            </h3>
            {hasLineItems && (
              <motion.span
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-[var(--color-muted)] flex-shrink-0"
              >
                <LuChevronRight size={14} />
              </motion.span>
            )}
          </div>

          <div className="flex items-baseline gap-2 flex-shrink-0">
            <p className="text-base tabular-nums whitespace-nowrap">
              <span
                className={`font-semibold ${
                  isFull
                    ? "text-emerald-600"
                    : isUnfunded
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-fg)]"
                }`}
              >
                {isUnfunded ? "—" : formatCurrency(goal.allocated)}
              </span>
              <span className="text-[var(--color-muted)] font-normal">
                {" "}/ {formatCurrency(goal.target)}
              </span>
            </p>

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

        {/* Thick green progress bar — animates width 0 -> actual. */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${fillPct}%` }}
              transition={{
                delay: Math.min(index * 0.05, 0.4) + 0.12,
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
          <span
            className={`text-[11px] tabular-nums w-11 text-right ${
              isFull
                ? "text-emerald-600 font-semibold"
                : "text-[var(--color-muted)]"
            }`}
          >
            {isUnfunded ? "0%" : `${pct}%`}
          </span>
        </div>

        {/* Tiny caps meta line. */}
        {metaParts.length > 0 && (
          <p
            className={`mt-2.5 text-[10px] uppercase tracking-[0.14em] truncate ${
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

        {/* Expandable line items — indented sub-list with their own bars. */}
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
              <div className="pt-5 pl-5 space-y-4">
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
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
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
                      <div className="h-1 w-full rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden">
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
