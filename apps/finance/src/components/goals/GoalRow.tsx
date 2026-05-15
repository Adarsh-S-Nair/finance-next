"use client";

import { useState, useRef } from "react";
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
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onEdit: (id: string) => void;
  onComplete: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function GoalRow({
  goal,
  isDragging,
  isDragTarget,
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
  const dragRef = useRef<HTMLDivElement>(null);

  const pace = evaluatePace(goal);
  const hasLineItems = goal.lineItems.length > 0;
  const pct = Math.round(goal.progress * 100);
  const isUnfunded = goal.allocated <= 0;
  const isFull = goal.progress >= 1;

  const fillPct = Math.min(100, Math.max(0, goal.progress * 100));

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", goal.id);
        onDragStart(goal.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(goal.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(goal.id);
      }}
      onDragEnd={() => onDragEnd()}
      className={`
        group relative isolate rounded-lg overflow-hidden transition-all
        ${isDragging ? "opacity-40" : ""}
        ${isDragTarget ? "ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]" : ""}
      `}
    >
      {/* Background fill — funded portion in the goal's color */}
      {fillPct > 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 -z-10 pointer-events-none transition-all duration-300"
          style={{
            width: `${fillPct}%`,
            backgroundColor: goal.color,
            opacity: isFull ? 0.22 : 0.16,
          }}
        />
      )}

      <div
        className="flex items-center gap-3 py-4 px-3 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]"
        onClick={() => hasLineItems && setExpanded((v) => !v)}
        style={{ cursor: hasLineItems ? "pointer" : "default" }}
      >
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-[var(--color-muted)] opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <LuGripVertical size={16} />
        </button>

        {/* Expand chevron (only if line items) */}
        <div className="w-4 flex justify-center flex-shrink-0">
          {hasLineItems ? (
            expanded ? (
              <LuChevronDown size={16} className="text-[var(--color-muted)]" />
            ) : (
              <LuChevronRight size={16} className="text-[var(--color-muted)]" />
            )
          ) : null}
        </div>

        {/* Color dot + protected shield */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: goal.color }}
            aria-hidden
          />
          {goal.isProtected && (
            <LuShield
              size={14}
              className="text-[var(--color-muted)]"
              aria-label="Protected goal"
            />
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-medium text-sm text-[var(--color-fg)] truncate">
              {goal.name}
            </p>
            <PaceBadge pace={pace} />
          </div>
          <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
            {goal.targetDate ? (
              <>by {relativeTargetDate(goal.targetDate)}</>
            ) : (
              <>no deadline</>
            )}
            {hasLineItems && (
              <>
                {" · "}
                {goal.lineItems.length} {goal.lineItems.length === 1 ? "item" : "items"}
              </>
            )}
          </p>
        </div>

        {/* Amount + progress */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm tabular-nums whitespace-nowrap">
            <span className="font-semibold text-[var(--color-fg)]">
              {formatCurrency(goal.allocated)}
            </span>
            <span className="text-[var(--color-muted)]">
              {" "}/ {formatCurrency(goal.target)}
            </span>
          </p>
          <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
            {isUnfunded ? "Unfunded" : `${pct}%`}
          </p>
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

      {/* Expanded line items */}
      {expanded && hasLineItems && (
        <div className="px-3 pb-4 pl-12">
          <div className="space-y-2 border-l-2 pl-4" style={{ borderColor: goal.color, opacity: 0.9 }}>
            {goal.lineItems.map((li) => {
              // Distribute goal.allocated across line items in declared order.
              // Same waterfall as the parent allocation, but scoped to this goal.
              const itemsBefore = goal.lineItems.slice(
                0,
                goal.lineItems.indexOf(li),
              );
              const consumedBefore = itemsBefore.reduce((s, x) => s + x.target, 0);
              const itemAllocated = Math.max(
                0,
                Math.min(li.target, goal.allocated - consumedBefore),
              );
              const itemPct = li.target > 0 ? (itemAllocated / li.target) * 100 : 0;
              return (
                <div key={li.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-xs text-[var(--color-fg)] truncate">
                        {li.name}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                        {formatCurrency(itemAllocated)} / {formatCurrency(li.target)}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, itemPct)}%`,
                          backgroundColor: goal.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PaceBadge({ pace }: { pace: Pace }) {
  if (pace === "no_date") return null;
  const styles: Record<Pace, { label: string; color: string }> = {
    on_pace: { label: "On pace", color: "text-emerald-600 dark:text-emerald-500" },
    ahead: { label: "Ahead", color: "text-emerald-600 dark:text-emerald-500" },
    behind: { label: "Behind", color: "text-amber-600 dark:text-amber-500" },
    unfunded: { label: "Unfunded", color: "text-[var(--color-muted)]" },
    complete: { label: "Complete", color: "text-emerald-600 dark:text-emerald-500" },
    no_date: { label: "", color: "" },
  };
  const s = styles[pace];
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wider ${s.color}`}>
      {s.label}
    </span>
  );
}
