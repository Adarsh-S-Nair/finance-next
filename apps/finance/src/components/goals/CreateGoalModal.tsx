"use client";

import { useEffect, useState } from "react";
import { LuPlus, LuTrash2, LuShield } from "react-icons/lu";
import { Modal, Button, Input } from "@zervo/ui";
import { formatCurrency } from "../../lib/formatCurrency";
import {
  type Goal,
  type GoalLineItem,
  type GoalKind,
  MOCK_MONTHLY_ESSENTIAL_SPEND,
  nextGoalColor,
} from "./types";

type DraftLineItem = { id: string; name: string; target: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  existingGoals: Goal[];
  /** If provided, we're editing this goal instead of creating a new one. */
  editGoal?: Goal | null;
  /** When true, opens directly into emergency-fund creation flow. */
  emergencyFundMode?: boolean;
};

export default function CreateGoalModal({
  isOpen,
  onClose,
  onSave,
  existingGoals,
  editGoal = null,
  emergencyFundMode = false,
}: Props) {
  const isEdit = !!editGoal;
  const isEmergency =
    emergencyFundMode || editGoal?.kind === "emergency_fund";

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  // Emergency fund multiplier (1..12)
  const [efMultiplier, setEfMultiplier] = useState(3);

  const suggestedEf = MOCK_MONTHLY_ESSENTIAL_SPEND * efMultiplier;

  useEffect(() => {
    if (!isOpen) return;
    if (editGoal) {
      setName(editGoal.name);
      setTarget(String(editGoal.target));
      setTargetDate(editGoal.targetDate ?? "");
      setLineItems(
        editGoal.lineItems.map((li) => ({
          id: li.id,
          name: li.name,
          target: String(li.target),
        })),
      );
    } else if (emergencyFundMode) {
      setName("Emergency Fund");
      setTarget(String(MOCK_MONTHLY_ESSENTIAL_SPEND * 3));
      setTargetDate("");
      setLineItems([]);
      setEfMultiplier(3);
    } else {
      setName("");
      setTarget("");
      setTargetDate("");
      setLineItems([]);
    }
  }, [isOpen, editGoal, emergencyFundMode]);

  // When the user adjusts the multiplier, keep the suggested target in sync.
  useEffect(() => {
    if (!isOpen || !emergencyFundMode || isEdit) return;
    setTarget(String(MOCK_MONTHLY_ESSENTIAL_SPEND * efMultiplier));
  }, [efMultiplier, isOpen, emergencyFundMode, isEdit]);

  const handleAddLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: `draft_${Date.now()}_${items.length}`, name: "", target: "" },
    ]);
  };

  const handleUpdateLineItem = (
    id: string,
    patch: Partial<Pick<DraftLineItem, "name" | "target">>,
  ) => {
    setLineItems((items) =>
      items.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((items) => items.filter((li) => li.id !== id));
  };

  const lineItemsSum = lineItems.reduce((sum, li) => sum + Number(li.target || 0), 0);
  const targetNum = Number(target || 0);
  const lineItemDelta = lineItemsSum - targetNum;
  const showLineItemBuffer = lineItems.length > 0 && Math.abs(lineItemDelta) >= 1;

  const canSave =
    name.trim().length > 0 && targetNum > 0 && lineItems.every((li) => li.name.trim() && Number(li.target) > 0);

  const handleSave = () => {
    if (!canSave) return;
    const kind: GoalKind = isEmergency ? "emergency_fund" : "custom";
    const finalLineItems: GoalLineItem[] = lineItems.map((li) => ({
      id: li.id,
      name: li.name.trim(),
      target: Number(li.target),
    }));

    if (isEdit && editGoal) {
      onSave({
        ...editGoal,
        name: name.trim(),
        target: targetNum,
        targetDate: targetDate || undefined,
        lineItems: finalLineItems,
      });
    } else {
      const maxPriority = existingGoals.reduce(
        (m, g) => (g.status === "active" ? Math.max(m, g.priority) : m),
        -1,
      );
      onSave({
        id: `g_${Date.now()}`,
        name: name.trim(),
        kind,
        target: targetNum,
        targetDate: targetDate || undefined,
        priority: isEmergency ? -1 : maxPriority + 1,
        status: "active",
        isProtected: isEmergency,
        color: isEmergency ? "#64748b" : nextGoalColor(existingGoals),
        lineItems: finalLineItems,
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? `Edit "${editGoal!.name}"`
          : isEmergency
            ? "Set up your emergency fund"
            : "New savings goal"
      }
      description={
        isEmergency && !isEdit
          ? "A protected goal that fills before anything else. Your other goals can't pull from it."
          : undefined
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Save changes" : "Create goal"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {isEmergency && !isEdit && (
          <EmergencyFundSuggestion
            multiplier={efMultiplier}
            onChange={setEfMultiplier}
            suggestedAmount={suggestedEf}
          />
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isEmergency ? "Emergency Fund" : "European Trip, New Couch, etc."
            }
            disabled={isEmergency && !isEdit}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
              Target
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0"
            />
          </div>
          {!isEmergency && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
                Target date (optional)
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {!isEmergency && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                Line items (optional)
              </label>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <LuPlus size={12} />
                Add item
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                Break your goal into pieces — e.g. for a trip: Flights, Hotel, Food.
              </p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li) => (
                  <div key={li.id} className="flex items-center gap-2">
                    <Input
                      value={li.name}
                      onChange={(e) =>
                        handleUpdateLineItem(li.id, { name: e.target.value })
                      }
                      placeholder="e.g. Flights"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={li.target}
                      onChange={(e) =>
                        handleUpdateLineItem(li.id, { target: e.target.value })
                      }
                      placeholder="0"
                      className="w-28"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(li.id)}
                      aria-label="Remove item"
                      className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                ))}
                {showLineItemBuffer && (
                  <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-1">
                    Items sum to {formatCurrency(lineItemsSum)} ·{" "}
                    {lineItemDelta > 0
                      ? `${formatCurrency(lineItemDelta)} over target`
                      : `${formatCurrency(Math.abs(lineItemDelta))} buffer remaining`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function EmergencyFundSuggestion({
  multiplier,
  onChange,
  suggestedAmount,
}: {
  multiplier: number;
  onChange: (n: number) => void;
  suggestedAmount: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-[var(--color-surface)] text-[var(--color-muted)] flex-shrink-0">
          <LuShield size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Suggested target: {formatCurrency(suggestedAmount)}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
            Based on your average{" "}
            <span className="tabular-nums">
              {formatCurrency(MOCK_MONTHLY_ESSENTIAL_SPEND)}/mo
            </span>{" "}
            in essential spending over the last 3 months × {multiplier}{" "}
            {multiplier === 1 ? "month" : "months"} of runway.
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider">
                Runway
              </span>
              <span className="text-xs text-[var(--color-fg)] tabular-nums">
                {multiplier} {multiplier === 1 ? "month" : "months"}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={multiplier}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-[var(--color-fg)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-0.5">
              <span>1mo</span>
              <span>6mo</span>
              <span>12mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
