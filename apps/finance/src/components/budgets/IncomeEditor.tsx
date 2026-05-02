"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LuPencil, LuCheck, LuX, LuTrash2 } from "react-icons/lu";
import { ConfirmOverlay } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Inline editor for the user's saved monthly_income
 * (user_profiles.monthly_income).
 *
 * Three states:
 * - "saved" — there's a real saved income from user_profiles. Displays
 *   the amount with edit + clear affordances.
 * - "fallback" — no saved income, but the budgets page has a
 *   history-derived fallback. Shows the fallback as a hint with a
 *   "Set" affordance.
 * - "empty" — neither. Shows a "Set monthly income" CTA.
 *
 * "Clear" sets monthly_income to null so the agent treats it as
 * unset on the next conversation. Useful for testing the "compute
 * income from scratch" agent flow without manually nulling the column
 * in the DB.
 */
export default function IncomeEditor({
  savedIncome,
  fallbackIncome,
  onChanged,
}: {
  savedIncome: number;
  fallbackIncome: number;
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasSaved = savedIncome > 0;
  const hasFallback = !hasSaved && fallbackIncome > 0;

  useEffect(() => {
    if (editing) {
      setDraft(hasSaved ? String(Math.round(savedIncome)) : "");
      setError(null);
      // Focus + select on next tick so the input renders first.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, hasSaved, savedIncome]);

  async function commit() {
    const cleaned = draft.trim().replace(/[$,]/g, "");
    const value = Number(cleaned);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/agent/user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_income: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${res.status})`,
        );
      }
      await onChanged();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setClearing(true);
    try {
      const res = await authFetch("/api/agent/user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_income: null }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      await onChanged();
      setConfirmingClear(false);
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-muted)]">Monthly take-home:</span>

        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              <span className="text-[var(--color-muted)]">$</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setError(null);
                  }
                }}
                disabled={saving}
                className="w-24 bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-fg)] outline-none tabular-nums text-[var(--color-fg)] py-0.5"
                placeholder="0"
              />
              <button
                type="button"
                onClick={commit}
                disabled={saving}
                className="p-1 rounded hover:bg-[var(--color-surface-alt)] text-emerald-500 disabled:opacity-50"
                aria-label="Save"
              >
                <LuCheck className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={saving}
                className="p-1 rounded hover:bg-[var(--color-surface-alt)] text-[var(--color-muted)] disabled:opacity-50"
                aria-label="Cancel"
              >
                <LuX className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              {error && (
                <span className="text-[11px] text-[var(--color-danger)] ml-1">
                  {error}
                </span>
              )}
            </motion.div>
          ) : hasSaved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              <span className="font-medium text-[var(--color-fg)] tabular-nums">
                {formatCurrency(savedIncome)}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
                aria-label="Edit monthly income"
              >
                <LuPencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-alt)] transition-colors"
                aria-label="Clear monthly income"
              >
                <LuTrash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ) : hasFallback ? (
            <motion.div
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-[var(--color-muted)] tabular-nums">
                ~{formatCurrency(fallbackIncome)}
              </span>
              <span className="text-[11px] text-[var(--color-muted)]">
                (estimated from history)
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[11px] text-[var(--color-fg)] hover:underline"
              >
                Set
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="empty"
              type="button"
              onClick={() => setEditing(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[var(--color-fg)] hover:underline"
            >
              Set monthly income
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <ConfirmOverlay
        isOpen={confirmingClear}
        onCancel={() => setConfirmingClear(false)}
        onConfirm={clear}
        title="Clear monthly income?"
        description="The agent will recompute it from your transaction history the next time you ask. You can always set it again."
        confirmLabel="Clear"
        busy={clearing}
        variant="danger"
      />
    </>
  );
}
