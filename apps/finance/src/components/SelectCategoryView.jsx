"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import SearchInput from "./ui/SearchInput";

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
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-5 pt-1 pb-4">
        <SearchInput
          placeholder="Search categories"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto px-5">
        {filteredGroups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-sm text-[var(--color-muted)]">No categories found</p>
          </motion.div>
        ) : (
          <div className="space-y-6 pb-6">
            {filteredGroups.map((group) => (
              <div key={group.id}>
                {/* Group label */}
                <div className="card-header mb-2">{group.name}</div>

                {/* Category rows */}
                <div>
                  {group.system_categories?.map((category) => {
                    const isSelected = currentCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => onSelectCategory(category)}
                        className={clsx(
                          "w-full flex items-center justify-between py-2.5 -mx-2 px-2 rounded-lg transition-colors",
                          isSelected
                            ? "bg-[var(--color-surface-alt)]"
                            : "hover:bg-[var(--color-surface-alt)]/40"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.hex_color || group.hex_color || 'var(--color-muted)' }}
                          />
                          <span className={clsx(
                            "text-sm",
                            isSelected ? "font-medium text-[var(--color-fg)]" : "text-[var(--color-fg)]"
                          )}>
                            {category.label}
                          </span>
                        </div>
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-fg)] flex-shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
