"use client";

import { useState, useMemo } from "react";
import { FiSearch, FiTag, FiCheck, FiX, FiChevronRight } from "react-icons/fi";
import DynamicIcon from "./DynamicIcon";
import Input from "./ui/Input";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

export default function SelectCategoryView({ categoryGroups = [], onSelectCategory, currentCategoryId }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

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

  // Auto-expand groups when searching
  const isSearching = searchQuery.trim().length > 0;

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const isGroupExpanded = (groupId) => {
    return isSearching || expandedGroups[groupId];
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Search Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]/20 bg-[var(--color-bg)]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-[var(--color-surface)] border-[var(--color-border)]/30 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 rounded-lg transition-all duration-150 text-sm font-light"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors p-0.5"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="mx-auto w-10 h-10 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-3">
              <FiSearch className="h-4 w-4 text-[var(--color-muted)]" />
            </div>
            <p className="text-sm font-light text-[var(--color-muted)]">No categories found</p>
          </motion.div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]/20">
            {filteredGroups.map((group) => {
              const expanded = isGroupExpanded(group.id);
              const categoryCount = group.system_categories?.length || 0;

              return (
                <div key={group.id}>
                  {/* Group Header - Clickable to expand */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface)]/40 transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: group.hex_color || 'var(--color-muted)',
                      }}
                    >
                      <DynamicIcon
                        iconLib={group.icon_lib}
                        iconName={group.icon_name}
                        className="h-3.5 w-3.5 text-white"
                        fallback={FiTag}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-sm font-normal text-[var(--color-fg)]">
                        {group.name}
                      </span>
                      <span className="ml-2 text-xs font-light text-[var(--color-muted)]">
                        {categoryCount}
                      </span>
                    </div>
                    <FiChevronRight
                      className={clsx(
                        "h-4 w-4 text-[var(--color-muted)]/60 transition-transform duration-200",
                        expanded && "rotate-90"
                      )}
                    />
                  </button>

                  {/* Category List */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="pb-3 px-4 pl-[3.75rem]">
                          <div className="flex flex-wrap gap-1.5">
                            {group.system_categories?.map((category) => {
                              const isSelected = currentCategoryId === category.id;
                              return (
                                <button
                                  key={category.id}
                                  onClick={() => onSelectCategory(category)}
                                  className={clsx(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-150",
                                    isSelected
                                      ? "text-white"
                                      : "bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]/30 font-light"
                                  )}
                                  style={isSelected ? { backgroundColor: group.hex_color || 'var(--color-accent)' } : {}}
                                >
                                  <span>{category.label}</span>
                                  {isSelected && (
                                    <FiCheck className="w-3 h-3" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
