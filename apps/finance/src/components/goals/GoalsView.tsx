"use client";

import { useMemo, useState } from "react";
import { LuPlus, LuShield, LuChevronDown, LuChevronRight } from "react-icons/lu";
import { Button, ConfirmOverlay } from "@zervo/ui";
import PageContainer from "../layout/PageContainer";
import { formatCurrency } from "../../lib/formatCurrency";
import CashAllocationStrip from "./CashAllocationStrip";
import GoalRow from "./GoalRow";
import CreateGoalModal from "./CreateGoalModal";
import {
  type Goal,
  MOCK_GOALS,
  MOCK_CASH_POOL,
  allocateCash,
} from "./types";

export default function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>(MOCK_GOALS);
  const [cashPool] = useState<number>(MOCK_CASH_POOL);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmergencyMode, setCreateEmergencyMode] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Drag-and-drop state for reordering active goals.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editingGoal = useMemo(
    () => goals.find((g) => g.id === editingGoalId) ?? null,
    [goals, editingGoalId],
  );

  // Run the allocation waterfall over only the active goals.
  const { allocated, unallocated } = useMemo(
    () => allocateCash(goals, cashPool),
    [goals, cashPool],
  );

  const activeAllocated = allocated; // already filtered to active inside allocateCash
  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === "complete"),
    [goals],
  );
  const archivedGoals = useMemo(
    () => goals.filter((g) => g.status === "archived"),
    [goals],
  );
  const pastGoals = [...completedGoals, ...archivedGoals];

  const hasEmergencyFund = useMemo(
    () => goals.some((g) => g.kind === "emergency_fund" && g.status === "active"),
    [goals],
  );

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleSaveGoal = (saved: Goal) => {
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === saved.id);
      if (exists) return prev.map((g) => (g.id === saved.id ? saved : g));
      return [...prev, saved];
    });
    setEditingGoalId(null);
    setCreateEmergencyMode(false);
  };

  const handleEdit = (id: string) => {
    setEditingGoalId(id);
    setCreateOpen(true);
  };

  const handleComplete = (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: "complete" as const } : g)),
    );
  };

  const handleArchive = (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: "archived" as const } : g)),
    );
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    setGoals((prev) => prev.filter((g) => g.id !== pendingDeleteId));
    setPendingDeleteId(null);
  };

  // ─── Drag-and-drop reordering ───────────────────────────────────────

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (id: string) => {
    if (draggingId && draggingId !== id) setDragOverId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      handleDragEnd();
      return;
    }

    const fromGoal = goals.find((g) => g.id === draggingId);
    const toGoal = goals.find((g) => g.id === targetId);
    if (!fromGoal || !toGoal) {
      handleDragEnd();
      return;
    }

    // Protected goals can't be demoted below an unprotected goal, and
    // an unprotected goal can't be promoted above a protected one.
    const violatesProtection =
      (fromGoal.isProtected && !toGoal.isProtected) ||
      (!fromGoal.isProtected && toGoal.isProtected);
    if (violatesProtection) {
      handleDragEnd();
      return;
    }

    setGoals((prev) => {
      const active = prev.filter((g) => g.status === "active");
      const inactive = prev.filter((g) => g.status !== "active");
      const sorted = [...active].sort((a, b) => {
        if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
        return a.priority - b.priority;
      });

      const fromIdx = sorted.findIndex((g) => g.id === draggingId);
      const toIdx = sorted.findIndex((g) => g.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);

      // Re-number priorities to match new order. Protected goals get
      // negative priorities so they always sort first.
      const reordered = sorted.map((g, i) => ({
        ...g,
        priority: g.isProtected ? -1 - (sorted.length - i) : i,
      }));

      const byId = new Map(reordered.map((g) => [g.id, g]));
      return prev.map((g) => byId.get(g.id) ?? g);
    });

    handleDragEnd();
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const totalAllocated = activeAllocated.reduce((sum, g) => sum + g.allocated, 0);

  return (
    <PageContainer
      title="Goals"
      action={
        <Button
          size="sm"
          variant="matte"
          onClick={() => {
            setEditingGoalId(null);
            setCreateEmergencyMode(false);
            setCreateOpen(true);
          }}
          className="gap-1.5 !rounded-full pl-3 pr-4"
        >
          <LuPlus className="w-3.5 h-3.5" />
          New Goal
        </Button>
      }
    >
      <section className="flex flex-col gap-10">
        {/* Setup nudge if no emergency fund */}
        {!hasEmergencyFund && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4 flex items-start gap-3">
            <div className="p-2 rounded-full bg-[var(--color-surface)] text-[var(--color-muted)] flex-shrink-0">
              <LuShield size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-fg)]">
                Set up your emergency fund first
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
                A protected savings goal that fills before any other goal. We
                recommend a few months of essential spending so you have a
                cushion before saving for non-essentials.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCreateEmergencyMode(true);
                setEditingGoalId(null);
                setCreateOpen(true);
              }}
            >
              Set up
            </Button>
          </div>
        )}

        {/* Cash allocation strip */}
        <CashAllocationStrip
          allocated={activeAllocated}
          unallocated={unallocated}
          cashPool={cashPool}
        />

        {/* Active goals list */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-medium text-[var(--color-fg)]">
                Your goals
              </h2>
              <span className="text-xs text-[var(--color-muted)] tabular-nums">
                {formatCurrency(totalAllocated)} flowing in
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-muted)] hidden sm:block">
              Drag to reorder — higher in the list fills first.
            </p>
          </div>

          {activeAllocated.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
              <p className="text-sm text-[var(--color-muted)]">
                No active goals yet.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCreateOpen(true)}
                className="mt-4"
              >
                Create your first goal
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 -mx-3">
              {activeAllocated.map((g) => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  isDragging={draggingId === g.id}
                  isDragTarget={dragOverId === g.id && draggingId !== g.id}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onEdit={handleEdit}
                  onComplete={handleComplete}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Past goals */}
        {pastGoals.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider hover:text-[var(--color-fg)] mb-4"
            >
              {showArchived ? (
                <LuChevronDown size={14} />
              ) : (
                <LuChevronRight size={14} />
              )}
              Past goals · {pastGoals.length}
            </button>
            {showArchived && (
              <div className="flex flex-col -mx-3">
                {pastGoals.map((g, i) => (
                  <div
                    key={g.id}
                    className={`flex items-center gap-3 py-3 px-3 ${
                      i < pastGoals.length - 1
                        ? "border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]"
                        : ""
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 opacity-60"
                      style={{ backgroundColor: g.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-fg)] truncate">
                        {g.name}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] tabular-nums">
                        {g.status === "complete" ? "Completed" : "Archived"} ·{" "}
                        {formatCurrency(g.target)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setGoals((prev) =>
                          prev.map((x) =>
                            x.id === g.id
                              ? { ...x, status: "active" as const }
                              : x,
                          ),
                        )
                      }
                      className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <CreateGoalModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingGoalId(null);
          setCreateEmergencyMode(false);
        }}
        onSave={handleSaveGoal}
        existingGoals={goals}
        editGoal={editingGoal}
        emergencyFundMode={createEmergencyMode}
      />

      <ConfirmOverlay
        isOpen={!!pendingDeleteId}
        variant="danger"
        title="Delete this goal?"
        description="The goal will be removed. Your bank balance and transaction history are not affected."
        confirmLabel="Delete"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </PageContainer>
  );
}
