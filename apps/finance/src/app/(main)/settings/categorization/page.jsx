"use client";

import { useState, useEffect, useCallback } from "react";
import { FiChevronRight } from "react-icons/fi";
import { Button, ConfirmOverlay, Drawer } from "@zervo/ui";
import { useUser } from "../../../../components/providers/UserProvider";
import { supabase } from "../../../../lib/supabase/client";
import { SettingsSection } from "../../../../components/settings/SettingsPrimitives";
import DynamicIcon from "../../../../components/DynamicIcon";
import RuleBuilder from "../../../../components/transactions/RuleBuilder";
import SelectCategoryView, {
  CategoryGroupListView,
} from "../../../../components/SelectCategoryView";

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

// Strip the synthetic `id` field RuleBuilder uses for keying before
// persisting back to the DB.
function stripConditionIds(conditions) {
  return (conditions || []).map(({ field, operator, value }) => ({
    field,
    operator,
    value,
  }));
}

// RuleBuilder needs each condition to have an `id` for React keying.
// DB-stored conditions don't have ids, so we seed them when opening the
// editor.
function seedConditionIds(conditions) {
  return (conditions || []).map((c, idx) => ({
    ...c,
    id: c.id ?? Date.now() + idx,
  }));
}

export default function CategorizationSettingsPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [rules, setRules] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editor drawer state
  const [editingRule, setEditingRule] = useState(null);
  const [editorView, setEditorView] = useState("editor"); // 'editor' | 'select-category' | 'select-category-group'
  const [draftConditions, setDraftConditions] = useState([]);
  const [draftCategory, setDraftCategory] = useState(null); // { id, label, hex_color, group }
  const [drilledGroup, setDrilledGroup] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
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

  // Load category groups lazily — needed only once the editor opens.
  const loadCategoryGroups = useCallback(async () => {
    if (categoryGroups.length > 0) return;
    const { data, error: fetchError } = await supabase
      .from("category_groups")
      .select(
        "id, name, icon_lib, icon_name, hex_color, system_categories(id, label, hex_color, direction)"
      )
      .order("name", { ascending: true });
    if (fetchError) {
      console.error("Failed to load category groups", fetchError);
      return;
    }
    const groups = (data || []).map((group) => ({
      ...group,
      system_categories: (group.system_categories || []).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    }));
    setCategoryGroups(groups);
  }, [categoryGroups.length]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openEditor = (rule) => {
    const cat = rule.system_categories;
    const group = cat?.category_groups;
    setEditingRule(rule);
    setDraftConditions(seedConditionIds(rule.conditions));
    setDraftCategory(
      cat
        ? {
            id: cat.id,
            label: cat.label,
            hex_color: cat.hex_color,
            direction: cat.direction,
            group: group || null,
          }
        : null
    );
    setEditorView("editor");
    setDrilledGroup(null);
    setSaveError(null);
    loadCategoryGroups();
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditingRule(null);
    setEditorView("editor");
    setDrilledGroup(null);
    setSaveError(null);
  };

  const handleEditorBack = () => {
    if (editorView === "select-category-group") {
      setEditorView("select-category");
      setDrilledGroup(null);
      return;
    }
    if (editorView === "select-category") {
      setEditorView("editor");
      return;
    }
    closeEditor();
  };

  const handleCategorySelect = (category) => {
    const owningGroup =
      drilledGroup ||
      categoryGroups.find((g) =>
        (g.system_categories || []).some((c) => c.id === category.id)
      ) ||
      null;
    setDraftCategory({
      id: category.id,
      label: category.label,
      hex_color: category.hex_color,
      direction: category.direction,
      group: owningGroup
        ? {
            id: owningGroup.id,
            name: owningGroup.name,
            hex_color: owningGroup.hex_color,
            icon_lib: owningGroup.icon_lib,
            icon_name: owningGroup.icon_name,
          }
        : null,
    });
    setEditorView("editor");
    setDrilledGroup(null);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    const cleaned = stripConditionIds(draftConditions).filter(
      (c) => c.value !== "" && c.value !== undefined && c.value !== null
    );
    if (cleaned.length === 0) {
      setSaveError("Add at least one condition with a value.");
      return;
    }
    if (!draftCategory?.id) {
      setSaveError("Pick a category.");
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const { error: updateError } = await supabase
      .from("category_rules")
      .update({
        category_id: draftCategory.id,
        conditions: cleaned,
      })
      .eq("id", editingRule.id);
    if (updateError) {
      console.error("Failed to update rule", updateError);
      setSaveError("Couldn't save. Try again in a moment.");
      setIsSaving(false);
      return;
    }
    await loadRules();
    setIsSaving(false);
    closeEditor();
  };

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
    // If this rule happened to be the one we were editing, close it.
    if (editingRule?.id === deletingRule.id) closeEditor();
  };

  const editorViews = [
    {
      id: "editor",
      title: "Edit rule",
      showBackButton: false,
      content: (
        <EditorView
          conditions={draftConditions}
          onConditionsChange={setDraftConditions}
          category={draftCategory}
          onChangeCategory={() => setEditorView("select-category")}
          onDelete={() => editingRule && setDeletingRule(editingRule)}
          onSave={handleSave}
          isSaving={isSaving}
          saveError={saveError}
        />
      ),
    },
    {
      id: "select-category",
      title: "Select Category",
      showBackButton: true,
      content: (
        <SelectCategoryView
          categoryGroups={categoryGroups}
          onSelectCategory={handleCategorySelect}
          currentCategoryId={draftCategory?.id}
          transactionAmount={null}
          onDrillGroup={(group) => {
            setDrilledGroup(group);
            setEditorView("select-category-group");
          }}
        />
      ),
    },
    {
      id: "select-category-group",
      title: drilledGroup?.name || "Category",
      showBackButton: true,
      content: (
        <CategoryGroupListView
          group={drilledGroup}
          onSelectCategory={handleCategorySelect}
          currentCategoryId={draftCategory?.id}
          transactionAmount={null}
        />
      ),
    },
  ];

  return (
    <>
      <SettingsSection label="Category rules" first>
        <p className="text-xs text-[var(--color-muted)] mb-4 max-w-md">
          Rules automatically categorize new transactions that match their
          conditions. Tap a rule to edit or delete it. Create new rules by
          picking a category in a transaction&rsquo;s drawer and choosing
          &ldquo;Apply to similar&rdquo;.
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
                <li key={rule.id}>
                  <button
                    type="button"
                    onClick={() => openEditor(rule)}
                    className="w-full flex items-center justify-between gap-4 py-3 px-2 rounded-md hover:bg-[var(--color-surface-alt)]/40 transition-colors text-left"
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
                    <FiChevronRight className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <Drawer
        isOpen={!!editingRule}
        onClose={closeEditor}
        title="Edit rule"
        size="md"
        views={editorViews}
        currentViewId={editorView}
        onViewChange={setEditorView}
        onBack={handleEditorBack}
      />

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

function EditorView({
  conditions,
  onConditionsChange,
  category,
  onChangeCategory,
  onDelete,
  onSave,
  isSaving,
  saveError,
}) {
  // RuleBuilder requires a truthy `criteria` to render. Seed it from
  // the first existing condition so it shows up correctly.
  const criteria = conditions[0]
    ? {
        field: conditions[0].field,
        operator: conditions[0].operator,
        value: conditions[0].value,
      }
    : { field: "merchant_name", operator: "is", value: "" };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6 pb-4">
        <RuleBuilder
          criteria={criteria}
          initialConditions={conditions}
          categoryName={category?.label || "Select category"}
          onRuleChange={onConditionsChange}
          onEditCategory={onChangeCategory}
        />

        {saveError && (
          <div className="text-xs text-[var(--color-danger)]">{saveError}</div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 px-5 py-3 border-t border-[var(--color-border)]/40 bg-[var(--color-content-bg)] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          className="text-sm font-medium text-[var(--color-danger)] hover:opacity-70 transition-opacity disabled:opacity-40"
        >
          Delete
        </button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
