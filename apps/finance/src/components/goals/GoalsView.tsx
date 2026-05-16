"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LuPlus, LuChevronDown, LuChevronRight } from "react-icons/lu";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ConfirmOverlay, EmptyState } from "@zervo/ui";
import PageContainer from "../layout/PageContainer";
import { formatCurrency } from "../../lib/formatCurrency";
import { useUser } from "../providers/UserProvider";
import { useAccounts } from "../providers/AccountsProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { authFetch } from "../../lib/api/fetch";
import CashAllocationStrip from "./CashAllocationStrip";
import GoalRow from "./GoalRow";
import CreateGoalOverlay from "./CreateGoalOverlay";
import { type Goal, allocateCash, rowToGoal } from "./types";

/**
 * Plaid depository subtypes we treat as part of the user's "available
 * cash" pool. Checking + savings + money market + cash management +
 * HSA + CDs — anything that can be drawn from without selling
 * something. Credit, loan, investment, and brokerage accounts don't
 * count toward goal funding.
 */
const DEPOSITORY_SUBTYPES = new Set([
  "checking",
  "savings",
  "money market",
  "cash management",
  "hsa",
  "cd",
]);

function isDepository(typeOrSubtype: string | null | undefined): boolean {
  if (!typeOrSubtype) return false;
  return DEPOSITORY_SUBTYPES.has(typeOrSubtype.toLowerCase());
}

type GoalsListResponse = {
  data?: Parameters<typeof rowToGoal>[0][];
};

export default function GoalsView() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { accounts: institutionGroups } = useAccounts();

  // Fetch goals from the API. react-query handles cross-mount caching
  // so navigating away and back paints from cache instead of flashing
  // an empty state — exactly what we wanted after the bug report where
  // the user thought their save was lost.
  const goalsKey = useMemo(() => ["goals:list", user?.id], [user?.id]);
  const { data: goalsPayload, isLoading: goalsLoading } =
    useAuthedQuery<GoalsListResponse>(
      goalsKey,
      user?.id ? "/api/goals" : null,
    );

  const goals: Goal[] = useMemo(
    () => (goalsPayload?.data ?? []).map(rowToGoal),
    [goalsPayload],
  );

  const refetchGoals = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: goalsKey });
  }, [queryClient, goalsKey]);

  // Cash pool = sum of all depository balances across the user's
  // connected Plaid accounts. Goals are abstract allocations against
  // this total — a "savings goal" doesn't need its own dedicated
  // account, the dollars just need to exist somewhere liquid.
  const cashPool = useMemo(() => {
    const flat = institutionGroups.flatMap(
      (g: { accounts?: { type: string | null; balance: number }[] }) =>
        g.accounts ?? [],
    );
    return flat
      .filter((a) => isDepository(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [institutionGroups]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmergencyMode, setCreateEmergencyMode] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editingGoal = useMemo(
    () => goals.find((g) => g.id === editingGoalId) ?? null,
    [goals, editingGoalId],
  );

  const { allocated, unallocated } = useMemo(
    () => allocateCash(goals, cashPool),
    [goals, cashPool],
  );

  const activeAllocated = allocated;
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

  const hasAnyGoals = goals.length > 0;
  const totalAllocated = activeAllocated.reduce((sum, g) => sum + g.allocated, 0);

  // ─── Handlers ───────────────────────────────────────────────────────

  const openCreate = (emergencyMode = false) => {
    setEditingGoalId(null);
    setCreateEmergencyMode(emergencyMode);
    setCreateOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingGoalId(id);
    setCreateOpen(true);
  };

  /**
   * Single mutation primitive used by complete/archive/reactivate and by
   * any other "patch a single field" call site. Falls back silently if
   * the request fails — react-query refetches on next focus anyway.
   */
  const patchGoal = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      try {
        const res = await authFetch(`/api/goals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) console.error("[goals] patch failed", await res.text());
      } catch (e) {
        console.error("[goals] patch threw", e);
      } finally {
        refetchGoals();
      }
    },
    [refetchGoals],
  );

  const handleComplete = (id: string) => patchGoal(id, { status: "complete" });
  const handleArchive = (id: string) => patchGoal(id, { status: "archived" });
  const handleReactivate = (id: string) => patchGoal(id, { status: "active" });

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await authFetch(`/api/goals/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) console.error("[goals] delete failed", await res.text());
    } catch (e) {
      console.error("[goals] delete threw", e);
    } finally {
      setPendingDeleteId(null);
      refetchGoals();
    }
  };

  // ─── Drag-and-drop reordering ───────────────────────────────────────

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (id: string) => {
    if (draggingId && draggingId !== id) setDragOverId(id);
  };
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = async (targetId: string) => {
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

    const violatesProtection =
      (fromGoal.isProtected && !toGoal.isProtected) ||
      (!fromGoal.isProtected && toGoal.isProtected);
    if (violatesProtection) {
      handleDragEnd();
      return;
    }

    // Compute the new order client-side, then send the full list of
    // active goal IDs to the reorder endpoint. The endpoint partitions
    // by is_protected and assigns priorities — we don't need to
    // pre-compute them here.
    const active = goals.filter((g) => g.status === "active");
    const sorted = [...active].sort((a, b) => {
      if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
      return a.priority - b.priority;
    });
    const fromIdx = sorted.findIndex((g) => g.id === draggingId);
    const toIdx = sorted.findIndex((g) => g.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      handleDragEnd();
      return;
    }
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);

    handleDragEnd();

    try {
      const res = await authFetch("/api/goals/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: sorted.map((g) => g.id) }),
      });
      if (!res.ok) console.error("[goals] reorder failed", await res.text());
    } catch (e) {
      console.error("[goals] reorder threw", e);
    } finally {
      refetchGoals();
    }
  };

  // ─── Empty state ────────────────────────────────────────────────────

  // While goals are loading for the first time, keep the page area blank
  // rather than flashing the FTUX empty state — the user almost lost
  // their mind over this once.
  if (!user?.id || (goalsLoading && !goalsPayload)) {
    return <PageContainer title="Goals" showHeader={false}><div /></PageContainer>;
  }

  if (!hasAnyGoals) {
    return (
      <PageContainer title="Goals" showHeader={false}>
        <EmptyState>
          <div className="py-16 lg:py-24 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] leading-[1.15] mb-6">
              Save for what matters.<br />
              Stay safe while you do.
            </h2>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed max-w-md mb-10">
              Set up a protected emergency fund first — it fills before any
              other goal. Then save toward trips, big purchases, or anything
              else you have in mind.
            </p>
            <Button size="lg" onClick={() => openCreate(true)}>
              Set up your emergency fund
            </Button>
          </div>
        </EmptyState>

        <CreateGoalOverlay
          isOpen={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setCreateEmergencyMode(false);
          }}
          onSaved={refetchGoals}
          existingGoals={goals}
          editGoal={null}
          emergencyFundMode={createEmergencyMode}
        />
      </PageContainer>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <PageContainer title="Goals">
      <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="lg:w-2/3 flex flex-col gap-10">
          <CashAllocationStrip
            allocated={activeAllocated}
            unallocated={unallocated}
            cashPool={cashPool}
          />

          <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3 min-w-0">
                <h2 className="text-lg font-medium text-[var(--color-fg)]">
                  Your goals
                </h2>
                {totalAllocated > 0 && (
                  <span className="text-xs text-[var(--color-muted)] tabular-nums truncate">
                    {formatCurrency(totalAllocated)} flowing in
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="matte"
                onClick={() => openCreate(false)}
                className="gap-1.5 !rounded-full pl-3 pr-4 flex-shrink-0"
              >
                <LuPlus className="w-3.5 h-3.5" />
                New Goal
              </Button>
            </div>

            {activeAllocated.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center">
                <p className="text-sm text-[var(--color-muted)]">
                  No active goals — past ones are below.
                </p>
              </div>
            ) : (
              <motion.div layout className="flex flex-col gap-3">
                {activeAllocated.map((g, i) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    index={i}
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
              </motion.div>
            )}
          </div>

          {pastGoals.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider hover:text-[var(--color-fg)] mb-4"
              >
                {showArchived ? (
                  <LuChevronDown size={12} />
                ) : (
                  <LuChevronRight size={12} />
                )}
                Past goals · {pastGoals.length}
              </button>
              {showArchived && (
                <div className="-mx-3">
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
                        className="w-2 h-2 rounded-full flex-shrink-0 opacity-50"
                        style={{ backgroundColor: g.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-fg)] truncate">
                          {g.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
                          {g.status === "complete" ? "Completed" : "Archived"} ·{" "}
                          {formatCurrency(g.target)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReactivate(g.id)}
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
        </div>

        <div className="lg:w-1/3 flex flex-col gap-6">
          {!hasEmergencyFund && (
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <p className="text-sm font-medium text-[var(--color-fg)] mb-1">
                Set up your emergency fund
              </p>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-3">
                A protected goal that fills before any other. Recommended
                before saving toward non-essentials.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openCreate(true)}
                className="!rounded-full"
              >
                Set it up
              </Button>
            </div>
          )}

          <div>
            <div className="card-header mb-3">How it works</div>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Your cash is split among active goals by priority. The top goal
              fills first, then the next, and so on. Reorder by dragging.
              Protected goals always fill before unprotected ones.
            </p>
          </div>
        </div>
      </section>

      <CreateGoalOverlay
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingGoalId(null);
          setCreateEmergencyMode(false);
        }}
        onSaved={refetchGoals}
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
