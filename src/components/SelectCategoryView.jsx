"use client";

import { useState, useMemo } from "react";
import { FiSearch, FiTag, FiCheck } from "react-icons/fi";
import DynamicIcon from "./DynamicIcon";
import Input from "./ui/Input";
import clsx from "clsx";

export default function SelectCategoryView({ categoryGroups = [], onSelectCategory, currentCategoryId }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return categoryGroups;

    const query = searchQuery.toLowerCase();
    return categoryGroups
      .map(group => {
        const groupMatches = group.name.toLowerCase().includes(query);
        const matchingChildren = group.system_categories?.filter(cat =>
          cat.label.toLowerCase().includes(query)
        );

        if (groupMatches) {
          return group;
        } else if (matchingChildren?.length > 0) {
          return {
            ...group,
            system_categories: matchingChildren
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [categoryGroups, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      <div className="px-4 py-2 border-b border-[var(--color-border)]/50">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--color-surface)] border-0 focus:ring-1 focus:ring-[var(--color-accent)] rounded-xl"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-muted)]">
            No categories found
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.id} className="space-y-1">
              {/* Group Header with Icon */}
              <div className="flex items-center gap-3 px-3 py-2 sticky top-0 bg-[var(--color-bg)]/95 backdrop-blur-sm z-10">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{
                    backgroundColor: group.hex_color ? `${group.hex_color}20` : 'var(--color-surface)',
                    color: group.hex_color || 'var(--color-fg)'
                  }}
                >
                  <DynamicIcon
                    iconLib={group.icon_lib}
                    iconName={group.icon_name}
                    className="h-4 w-4"
                    fallback={FiTag}
                  />
                </div>
                <span className="text-sm font-semibold text-[var(--color-fg)]">
                  {group.name}
                </span>
              </div>

              {/* Category Items */}
              <div className="grid grid-cols-1 gap-0.5">
                {group.system_categories?.map(category => {
                  const isSelected = currentCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => onSelectCategory(category)}
                      className={clsx(
                        "flex items-center gap-3 py-2.5 px-3 ml-3 rounded-lg transition-all duration-200 text-left group border border-transparent",
                        isSelected
                          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20"
                          : "hover:bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-border)]/50"
                      )}
                    >
                      <div className="flex-1 min-w-0 pl-9"> {/* Indent to align with text in header (8px icon + 12px gap + padding) approx */}
                        <div className="font-medium text-sm truncate">{category.label}</div>
                      </div>
                      {isSelected && (
                        <FiCheck className="w-4 h-4 text-[var(--color-accent)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
