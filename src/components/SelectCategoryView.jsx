"use client";

import { useState, useMemo } from "react";
import { FiSearch, FiTag, FiCheck, FiX } from "react-icons/fi";
import DynamicIcon from "./DynamicIcon";
import Input from "./ui/Input";
import clsx from "clsx";
import { motion } from "framer-motion";

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
      {/* Search Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]/50 bg-[var(--color-bg)]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="relative group">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-[var(--color-surface)] border-transparent focus:bg-[var(--color-bg)] focus:border-[var(--color-accent)]/50 focus:ring-4 focus:ring-[var(--color-accent)]/10 rounded-xl transition-all duration-200 shadow-sm"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {filteredGroups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="mx-auto w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-3">
              <FiSearch className="h-6 w-6 text-[var(--color-muted)]" />
            </div>
            <p className="text-[var(--color-muted)] font-medium">No categories found</p>
          </motion.div>
        ) : (
          filteredGroups.map((group, groupIndex) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.05, duration: 0.3 }}
              className="bg-[var(--color-surface)]/30 border border-[var(--color-border)]/40 rounded-2xl p-3 space-y-3"
            >
              {/* Group Header */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{
                    backgroundColor: group.hex_color || 'var(--color-muted)',
                    color: '#ffffff'
                  }}
                >
                  <DynamicIcon
                    iconLib={group.icon_lib}
                    iconName={group.icon_name}
                    className="h-3.5 w-3.5"
                    fallback={FiTag}
                  />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-fg)] tracking-tight">
                  {group.name}
                </h3>
              </div>

              {/* Category Grid */}
              <div className="grid grid-cols-2 gap-2">
                {group.system_categories?.map((category) => {
                  const isSelected = currentCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => onSelectCategory(category)}
                      className={clsx(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200 text-left cursor-pointer group",
                        isSelected
                          ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/20 font-medium"
                          : "bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      <span className="truncate mr-2">{category.label}</span>
                      {isSelected && (
                        <FiCheck className="w-3.5 h-3.5 text-white flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
