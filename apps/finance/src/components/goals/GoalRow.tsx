"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LuShield,
  LuChevronDown,
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
 * Single goal row — a card with a thick green progress bar, the goal's
 * own color reduced to a small accent dot, and a hover lift.
 *
 * Animations on mount via framer-motion: a staggered fade+slide for
 * the card, and a width transition for the progress bar so the user
 * sees the dollars flowing in rather than appearing instantly.
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

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.04, 0.3),
        duration: 0.3,
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
      <div
        className={`
          relative rounded-2xl border transition-all duration-200
          ${
            isDragTarget
              ? "border-emerald-500/60 bg-[color-mix(in_oklab,var(--color-success),transparent_94%)] shadow-md"
              : "border-[color-mix(in_oklab,var(--color-fg),transparent_92%)] bg-[var(--color-bg)] hover:border-[color-mix(in_oklab,var(--color-fg),transparent_86%)] hover:shadow-sm hover:-translate-y-px"
          }
        `}
      >
        {/* Header row (name + amount). Click toggles expansion if line items exist. */}
        <div
          className="flex items-start gap-3 px-4 pt-4 pb-3"
          onClick={() => hasLineItems && setExpanded((v) => !v)}
          style={{ cursor: hasLineItems ? "pointer" : "default" }}
        >
          {/* Drag affordance (hover-only). */}
          <button
            type="button"
            aria-label="Drag to reorder"
            className="text-[var(--color-muted)] opacity-0 group-hover:opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing -ml-1 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <LuGripVertical size={14} />
          </button>

          {/* Color dot + protected shield. */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: goal.color }}
              aria-hidden
            />
            {goal.isProtected && (
              <LuShield
                size={12}
                className="text-[var(--color-muted)]"
                aria-label="Protected goal"
              />
            )}
          </div>

          {/* Main column: name on top, meta line below. */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--color-fg)] truncate">
                  {goal.name}
                </p>
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
              <p className="text-sm tabular-nums whitespace-nowrap flex-shrink-0">
                <span className="font-semibold text-[var(--color-fg)]">
                  {formatCurrency(goal.allocated)}
                </span>
                <span className="text-[var(--color-muted)] font-normal">
                  {" "}/ {formatCurrency(goal.target)}
                </span>
              </p>
            </div>

            <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
              {goal.targetDate ? (
                <span>Due {relativeTargetDate(goal.targetDate)}</span>
              ) : null}
              <PaceTag pace={pace} hasDate={!!goal.targetDate} />
              {hasLineItems && (
                <>
                  <span>·</span>
                  <span>
                    {goal.lineItems.length}{" "}
                    {goal.lineItems.length === 1 ? "item" : "items"}
                  </span>
                </>
              )}
              {!goal.targetDate && !hasLineItems && pace === "unfunded" && (
                <span>Waiting on funds</span>
              )}
              {!goal.targetDate && !hasLineItems && pace !== "unfunded" && (
                <span>No deadline</span>
              )}
            </div>
          </div>

          {/* Actions menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <button
                  type="button"
                  aria-label={`Actions for ${goal.name}`}
                  className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] rounded opacity-0 group-hover:opacity-100"
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

        {/* Thick green progress bar — animates width from 0 on mount. */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{
                  delay: Math.min(index * 0.04, 0.3) + 0.1,
                  duration: 0.7,
                  ease: "easeOut",
                }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: GREEN_FILL,
                  // Add a soft glow when fully funded — small celebratory cue.
                  boxShadow: isFull
                    ? `0 0 12px ${GREEN_FILL}55`
                    : undefined,
                }}
              />
            </div>
            <span
              className={`text-[11px] tabular-nums w-12 text-right ${
                isFull
                  ? "text-emerald-600 font-semibold"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {isUnfunded ? "—" : `${pct}%`}
            </span>
          </div>
        </div>

        {/* Expandable line items — animate height + opacity. */}
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
              <div className="px-4 pb-4 pt-1 border-t border-[color-mix(in_oklab,var(--color-fg),transparent_94%)]">
                <div className="space-y-3 mt-3">
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
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="text-xs text-[var(--color-fg)] truncate">
                            {li.name}
                          </span>
                          <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                            {formatCurrency(itemAllocated)} /{" "}
                            {formatCurrency(li.target)}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_93%)] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, itemPct)}%` }}
                            transition={{
                              delay: 0.05 + idx * 0.04,
                              duration: 0.5,
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PaceTag({ pace, hasDate }: { pace: Pace; hasDate: boolean }) {
  if (!hasDate) return null;
  if (pace === "no_date" || pace === "complete") return null;

  if (pace === "behind") {
    return (
      <>
        <span>·</span>
        <span className="text-amber-600 dark:text-amber-500">Behind pace</span>
      </>
    );
  }
  if (pace === "ahead") {
    return (
      <>
        <span>·</span>
        <span className="text-emerald-600 dark:text-emerald-500">Ahead</span>
      </>
    );
  }
  if (pace === "on_pace") {
    return (
      <>
        <span>·</span>
        <span className="text-emerald-600 dark:text-emerald-500">On pace</span>
      </>
    );
  }
  if (pace === "unfunded") {
    return (
      <>
        <span>·</span>
        <span>Not yet funded</span>
      </>
    );
  }
  return null;
}
