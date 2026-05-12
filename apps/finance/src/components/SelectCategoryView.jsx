"use client";

import { useState, useMemo, useEffect } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronRight, FiChevronLeft } from "react-icons/fi";
import SearchInput from "./ui/SearchInput";
import DynamicIcon from "./DynamicIcon";

export default function SelectCategoryView({
  categoryGroups = [],
  onSelectCategory,
  currentCategoryId,
  transactionAmount = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [drilledGroupId, setDrilledGroupId] = useState(null);

  // When picking a category for a specific transaction, hide categories
  // whose `direction` conflicts with the transaction's sign — negative
  // transactions can only land in `expense`/`both` categories, positive
  // in `income`/`both`. Mirrors the DB trigger so the user never picks
  // something that would be rejected on save. When transactionAmount is
  // null (filter use, no transaction context), show everything.
  const allowedDirection = useMemo(() => {
    if (transactionAmount == null) return null;
    if (transactionAmount > 0) return "income";
    if (transactionAmount < 0) return "expense";
    return null;
  }, [transactionAmount]);

  const directionFilteredGroups = useMemo(() => {
    if (!allowedDirection) return categoryGroups;
    return categoryGroups
      .map((group) => {
        const allowed = (group.system_categories || []).filter(
          (cat) => !cat.direction || cat.direction === allowedDirection || cat.direction === "both"
        );
        if (allowed.length === 0) return null;
        return { ...group, system_categories: allowed };
      })
      .filter(Boolean);
  }, [categoryGroups, allowedDirection]);

  const isSearching = searchQuery.trim().length > 0;

  // Searching takes precedence over a drilled-in group — typing exits the
  // drill so the user can scan the whole flat result set without confusion.
  useEffect(() => {
    if (isSearching && drilledGroupId) setDrilledGroupId(null);
  }, [isSearching, drilledGroupId]);

  const drilledGroup = useMemo(
    () => directionFilteredGroups.find((g) => g.id === drilledGroupId) ?? null,
    [directionFilteredGroups, drilledGroupId]
  );

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    for (const group of directionFilteredGroups) {
      const groupMatches = group.name.toLowerCase().includes(q);
      for (const cat of group.system_categories || []) {
        if (groupMatches || cat.label.toLowerCase().includes(q)) {
          results.push({ category: cat, group });
        }
      }
    }
    return results;
  }, [directionFilteredGroups, isSearching, searchQuery]);

  const renderGroupRow = (group) => (
    <button
      key={group.id}
      type="button"
      onClick={() => setDrilledGroupId(group.id)}
      className="w-full flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
    >
      <CategoryIconBadge
        hexColor={group.hex_color}
        iconLib={group.icon_lib}
        iconName={group.icon_name}
      />
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm text-[var(--color-fg)] truncate">{group.name}</div>
        <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
          {(group.system_categories || []).length} categories
        </div>
      </div>
      <FiChevronRight className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
    </button>
  );

  const renderCategoryRow = (category, group) => {
    const isSelected = currentCategoryId === category.id;
    return (
      <button
        key={category.id}
        type="button"
        onClick={() => onSelectCategory(category)}
        className={clsx(
          "w-full flex items-center justify-between py-2.5 -mx-2 px-2 rounded-lg transition-colors",
          isSelected
            ? "bg-[var(--color-surface-alt)]"
            : "hover:bg-[var(--color-surface-alt)]/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: category.hex_color || group?.hex_color || "var(--color-muted)",
            }}
          />
          <span
            className={clsx(
              "text-sm truncate",
              isSelected ? "font-medium text-[var(--color-fg)]" : "text-[var(--color-fg)]"
            )}
          >
            {category.label}
          </span>
        </div>
        {isSelected && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-fg)] flex-shrink-0"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-1 pb-3">
        <SearchInput
          placeholder="Search categories"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 relative">
        <AnimatePresence mode="wait" initial={false}>
          {isSearching ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {searchResults.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-[var(--color-muted)]">No categories found</p>
                </div>
              ) : (
                <div>
                  {searchResults.map(({ category, group }) => {
                    const isSelected = currentCategoryId === category.id;
                    return (
                      <button
                        key={`${group.id}:${category.id}`}
                        type="button"
                        onClick={() => onSelectCategory(category)}
                        className={clsx(
                          "w-full flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg transition-colors",
                          isSelected
                            ? "bg-[var(--color-surface-alt)]"
                            : "hover:bg-[var(--color-surface-alt)]/40"
                        )}
                      >
                        <CategoryIconBadge
                          hexColor={group.hex_color}
                          iconLib={group.icon_lib}
                          iconName={group.icon_name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <div
                            className={clsx(
                              "text-sm truncate",
                              isSelected
                                ? "font-medium text-[var(--color-fg)]"
                                : "text-[var(--color-fg)]"
                            )}
                          >
                            {category.label}
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
                            {group.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : drilledGroup ? (
            <motion.div
              key={`drill-${drilledGroup.id}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.16 }}
            >
              <button
                type="button"
                onClick={() => setDrilledGroupId(null)}
                className="flex items-center gap-1.5 mb-3 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                <FiChevronLeft className="w-3.5 h-3.5" />
                All groups
              </button>
              <div className="flex items-center gap-2.5 mb-3">
                <CategoryIconBadge
                  hexColor={drilledGroup.hex_color}
                  iconLib={drilledGroup.icon_lib}
                  iconName={drilledGroup.icon_name}
                  size="sm"
                />
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {drilledGroup.name}
                </span>
              </div>
              <div>
                {(drilledGroup.system_categories || []).map((cat) =>
                  renderCategoryRow(cat, drilledGroup)
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="groups"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.16 }}
            >
              {directionFilteredGroups.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-[var(--color-muted)]">No categories found</p>
                </div>
              ) : (
                <div>{directionFilteredGroups.map(renderGroupRow)}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CategoryIconBadge({ hexColor, iconLib, iconName, size = "md" }) {
  const dim = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div
      className={clsx(
        "rounded-full flex items-center justify-center flex-shrink-0",
        dim
      )}
      style={{ backgroundColor: hexColor || "var(--color-accent)" }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className={clsx(iconDim, "text-white")}
        style={{ strokeWidth: 2.25 }}
      />
    </div>
  );
}
