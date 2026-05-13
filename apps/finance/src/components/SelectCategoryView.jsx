"use client";

import { useState } from "react";
import clsx from "clsx";
import SearchInput from "./ui/SearchInput";
import DynamicIcon from "./DynamicIcon";

/**
 * Drill-down category picker, single-select. Two complementary views:
 *
 *   - SelectCategoryView         → list of category groups + search
 *   - CategoryGroupListView      → flat list of categories for one drilled group
 *
 * Drill state lives in the parent so the host Drawer's own header back
 * button does the navigation (instead of an in-content back link). The
 * parent toggles between two drawer views and passes the drilled group
 * to the second one.
 */

function allowedDirectionFor(transactionAmount) {
  if (transactionAmount == null) return null;
  if (transactionAmount > 0) return "income";
  if (transactionAmount < 0) return "expense";
  return null;
}

function filterGroupCategoriesByDirection(categoryGroups, allowedDirection) {
  if (!allowedDirection) return categoryGroups;
  return categoryGroups
    .map((group) => {
      const allowed = (group.system_categories || []).filter(
        (cat) =>
          !cat.direction ||
          cat.direction === allowedDirection ||
          cat.direction === "both"
      );
      if (allowed.length === 0) return null;
      return { ...group, system_categories: allowed };
    })
    .filter(Boolean);
}

// "Other" pinned to the bottom of the group list (catch-all bucket).
// Partition rather than sort — React Compiler flags sort() as mutation.
function pinOtherLast(groups) {
  return [
    ...groups.filter((g) => g.name !== "Other"),
    ...groups.filter((g) => g.name === "Other"),
  ];
}

export default function SelectCategoryView({
  categoryGroups = [],
  onSelectCategory,
  onDrillGroup,
  currentCategoryId,
  transactionAmount = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const allowedDirection = allowedDirectionFor(transactionAmount);
  const directionAllowed = filterGroupCategoriesByDirection(
    categoryGroups,
    allowedDirection
  );
  const orderedGroups = pinOtherLast(directionAllowed);

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = (() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    for (const group of orderedGroups) {
      const groupMatches = group.name.toLowerCase().includes(q);
      for (const cat of group.system_categories || []) {
        if (groupMatches || cat.label.toLowerCase().includes(q)) {
          results.push({ category: cat, group });
        }
      }
    }
    return results;
  })();

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3">
        <SearchInput
          placeholder="Search categories"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-[var(--color-muted)]">
                No categories found
              </p>
            </div>
          ) : (
            <div>
              {searchResults.map(({ category, group }) => (
                <SearchHitRow
                  key={`${group.id}:${category.id}`}
                  category={category}
                  group={group}
                  isSelected={currentCategoryId === category.id}
                  onSelect={() => onSelectCategory(category)}
                />
              ))}
            </div>
          )
        ) : orderedGroups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--color-muted)]">
              No categories found
            </p>
          </div>
        ) : (
          <div>
            {orderedGroups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                currentCategoryId={currentCategoryId}
                onDrillGroup={onDrillGroup}
                onSelectCategory={onSelectCategory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Flat category list for one drilled group, single-select. The drawer
 * supplies the back chevron + title in its own header, so this view
 * renders just the list.
 */
export function CategoryGroupListView({
  group,
  onSelectCategory,
  currentCategoryId,
  transactionAmount = null,
}) {
  if (!group) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-muted)]">
          No group selected
        </p>
      </div>
    );
  }
  const allowedDirection = allowedDirectionFor(transactionAmount);
  const cats = (group.system_categories || []).filter(
    (cat) =>
      !allowedDirection ||
      !cat.direction ||
      cat.direction === allowedDirection ||
      cat.direction === "both"
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {cats.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--color-muted)]">
              No categories available
            </p>
          </div>
        ) : (
          <div>
            {cats.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                group={group}
                isSelected={currentCategoryId === category.id}
                onSelect={() => onSelectCategory(category)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupRow({ group, currentCategoryId, onDrillGroup, onSelectCategory }) {
  const cats = group.system_categories || [];

  // Single-category groups (today: "Other") render their lone child
  // inline at the top level — drilling into a one-item list is just a
  // wasted tap.
  if (cats.length === 1) {
    const category = cats[0];
    const isSelected = currentCategoryId === category.id;
    return (
      <button
        type="button"
        onClick={() => onSelectCategory(category)}
        className={clsx(
          "w-full flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors",
          isSelected
            ? "bg-[var(--color-surface-alt)]"
            : "hover:bg-[var(--color-surface-alt)]/40"
        )}
      >
        <CategoryIconBadge
          hexColor={group.hex_color}
          iconLib={group.icon_lib}
          iconName={group.icon_name}
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
        </div>
        {isSelected && <CheckmarkIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onDrillGroup?.(group)}
      className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors text-left"
    >
      <CategoryIconBadge
        hexColor={group.hex_color}
        iconLib={group.icon_lib}
        iconName={group.icon_name}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-fg)] truncate">
          {group.name}
        </div>
      </div>
      <ChevronRightIcon />
    </button>
  );
}

function CategoryRow({ category, group, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full flex items-center justify-between py-2.5 px-1 rounded-lg transition-colors",
        isSelected
          ? "bg-[var(--color-surface-alt)]"
          : "hover:bg-[var(--color-surface-alt)]/40"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor:
              category.hex_color ||
              group?.hex_color ||
              "var(--color-muted)",
          }}
        />
        <span
          className={clsx(
            "text-sm truncate",
            isSelected
              ? "font-medium text-[var(--color-fg)]"
              : "text-[var(--color-fg)]"
          )}
        >
          {category.label}
        </span>
      </div>
      {isSelected && <CheckmarkSmallIcon />}
    </button>
  );
}

function SearchHitRow({ category, group, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors",
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
}

export function CategoryIconBadge({ hexColor, iconLib, iconName, size = "md" }) {
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

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-muted)] flex-shrink-0"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="text-[var(--color-fg)] flex-shrink-0"
    >
      <path
        d="M3 8.5L6.5 12L13 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckmarkSmallIcon() {
  return (
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
  );
}
