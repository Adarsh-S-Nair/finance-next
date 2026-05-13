"use client";

import { useState, useEffect, useCallback } from "react";
import { FiTrash2 } from "react-icons/fi";
import { ConfirmOverlay } from "@zervo/ui";
import { useUser } from "../../../../components/providers/UserProvider";
import { supabase } from "../../../../lib/supabase/client";
import { SettingsSection } from "../../../../components/settings/SettingsPrimitives";
import DynamicIcon from "../../../../components/DynamicIcon";

const FIELD_LABELS = {
  merchant_name: "Merchant",
  description: "Description",
  amount: "Amount",
};

const OPERATOR_LABELS = {
  is: "is",
  equals: "equals",
  contains: "contains",
  starts_with: "starts with",
  is_greater_than: "is greater than",
  is_less_than: "is less than",
};

function formatConditionValue(field, value) {
  if (field === "amount") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }
  return `"${value}"`;
}

function formatConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return "No conditions";
  }
  return conditions
    .map((c) => {
      const field = FIELD_LABELS[c.field] || c.field;
      const op = OPERATOR_LABELS[c.operator] || c.operator;
      const value = formatConditionValue(c.field, c.value);
      return `${field} ${op} ${value}`;
    })
    .join(" and ");
}

export default function CategorizationSettingsPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingRule, setDeletingRule] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRules = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("category_rules")
      .select(
        `id, conditions, created_at, category_id,
         system_categories (
           id,
           label,
           hex_color,
           direction,
           category_groups ( id, name, hex_color, icon_lib, icon_name )
         )`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Failed to load category rules", fetchError);
      setError("Couldn't load your rules. Try again in a moment.");
      setLoading(false);
      return;
    }
    setRules(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleConfirmDelete = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);
    const { error: deleteError } = await supabase
      .from("category_rules")
      .delete()
      .eq("id", deletingRule.id);
    if (deleteError) {
      console.error("Failed to delete rule", deleteError);
      alert("Couldn't delete that rule. Try again in a moment.");
      setIsDeleting(false);
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
    setDeletingRule(null);
    setIsDeleting(false);
  };

  return (
    <>
      <SettingsSection label="Category rules" first>
        <p className="text-xs text-[var(--color-muted)] mb-4 max-w-md">
          Rules automatically categorize new transactions that match their
          conditions. Create one by picking a category in a
          transaction&rsquo;s drawer and choosing &ldquo;Apply to
          similar&rdquo;.
        </p>

        {loading ? (
          <div className="py-6 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-fg)]/40 mx-auto mb-2"></div>
            <p className="text-xs text-[var(--color-muted)]">Loading…</p>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-[var(--color-muted)]">{error}</div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">No rules yet</p>
            <p className="text-xs text-[var(--color-muted)] mt-1 max-w-xs mx-auto">
              Categorize a transaction and tap &ldquo;Apply to similar&rdquo;
              to teach Zervo a pattern.
            </p>
          </div>
        ) : (
          <ul className="-mx-2">
            {rules.map((rule) => {
              const cat = rule.system_categories;
              const group = cat?.category_groups;
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-4 py-3 px-2 rounded-md hover:bg-[var(--color-surface-alt)]/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor:
                          group?.hex_color || cat?.hex_color || "var(--color-accent)",
                      }}
                    >
                      <DynamicIcon
                        iconLib={group?.icon_lib}
                        iconName={group?.icon_name}
                        className="h-4 w-4 text-white"
                        style={{ strokeWidth: 2.25 }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--color-fg)] truncate">
                        {formatConditions(rule.conditions)}
                      </div>
                      <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
                        Categorize as{" "}
                        <span className="text-[var(--color-fg)]">
                          {cat?.label || "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingRule(rule)}
                    aria-label="Delete rule"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-danger)] flex-shrink-0"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <ConfirmOverlay
        isOpen={!!deletingRule}
        onCancel={() => (isDeleting ? null : setDeletingRule(null))}
        onConfirm={handleConfirmDelete}
        title="Delete this rule?"
        description={
          deletingRule
            ? `Future transactions matching "${formatConditions(
                deletingRule.conditions
              )}" will no longer be auto-categorized. Already-categorized transactions stay where they are.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting…"
      />
    </>
  );
}
