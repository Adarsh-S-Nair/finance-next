"use client";

import { useState } from "react";
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
  isLast: boolean;
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
  isLast,
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

  const fillPct = Math.min(100, Math.max(0, goal.progress * 100));

  return (
    <div
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
        group relative transition-opacity
        ${!isLast ? "border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]" : ""}
        ${isDragging ? "opacity-40" : ""}
        ${isDragTarget ? "bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)]" : ""}
      `}
    >
      <div
        className="flex items-center gap-3 py-4 px-3 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_97%)] rounded-lg"
        onClick={() => hasLineItems && setExpanded((v) => !v)}
        style={{ cursor: hasLineItems ? "pointer" : "default" }}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-[var(--color-muted)] opacity-0 group-hover:opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing -ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          <LuGripVertical size={14} />
        </button>

        <div className="w-3 flex justify-center flex-shrink-0">
          {hasLineItems ? (
            expanded ? (
              <LuChevronDown size={12} className="text-[var(--color-muted)]" />
            ) : (
              <LuChevronRight size={12} className="text-[var(--color-muted)]" />
            )
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: goal.color }}
            aria-hidden
          />
          {goal.isProtected && (
            <LuShield
              size={11}
              className="text-[var(--color-muted)]"
              aria-label="Protected goal"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-sm font-medium text-[var(--color-fg)] truncate">
              {goal.name}
            </p>
            <p className="text-sm tabular-nums whitespace-nowrap flex-shrink-0">
              <span className="font-medium text-[var(--color-fg)]">
                {formatCurrency(goal.allocated)}
              </span>
              <span className="text-[var(--color-muted)]">
                {" "}/ {formatCurrency(goal.target)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-[3px] rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_92%)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${fillPct}%`,
                  backgroundColor: goal.color,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--color-muted)] tabular-nums w-9 text-right">
              {isUnfunded ? "—" : `${pct}%`}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            {goal.targetDate && (
              <>
                <span>Due {relativeTargetDate(goal.targetDate)}</span>
              </>
            )}
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

      {expanded && hasLineItems && (
        <div className="px-3 pb-4 pl-14">
          <div className="space-y-2.5">
            {goal.lineItems.map((li, idx) => {
              const consumedBefore = goal.lineItems
                .slice(0, idx)
                .reduce((s, x) => s + x.target, 0);
              const itemAllocated = Math.max(
                0,
                Math.min(li.target, goal.allocated - consumedBefore),
              );
              const itemPct = li.target > 0 ? (itemAllocated / li.target) * 100 : 0;
              return (
                <div key={li.id}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xs text-[var(--color-fg)] truncate">
                      {li.name}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                      {formatCurrency(itemAllocated)} / {formatCurrency(li.target)}
                    </span>
                  </div>
                  <div className="h-[2px] w-full rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_92%)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, itemPct)}%`,
                        backgroundColor: goal.color,
                        opacity: 0.7,
                      }}
                    />
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
