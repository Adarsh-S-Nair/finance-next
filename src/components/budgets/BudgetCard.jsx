"use client";

import React from "react";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import * as Icons from "lucide-react";

export default function BudgetCard({ budget, onDelete }) {
  // Destructure budget data
  const { category_groups, system_categories, amount, spent, remaining, percentage } = budget;

  // Determine label and icon
  const isGroup = !!category_groups;
  const label = isGroup ? category_groups.name : system_categories?.label || "Unknown";

  // Icon handling
  const iconName = isGroup ? category_groups.icon_name : null; // System categories might not have icons unless linked to group
  const IconComponent = iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;

  // Helper to format currency
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  // Status color
  let colorClass = "bg-emerald-500";
  if (percentage > 85) colorClass = "bg-amber-500";
  if (percentage >= 100) colorClass = "bg-rose-500";

  return (
    <Card className="flex flex-col gap-4 p-5 hover:shadow-md transition-shadow relative group">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[var(--color-bg-secondary)] rounded-xl text-[var(--color-fg-secondary)]">
            <IconComponent size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-fg)]">{label}</h3>
            <p className="text-xs text-[var(--color-muted)]">
              {isGroup ? "Category Group" : "Category"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-[var(--color-fg)]">
            {formatCurrency(remaining)} left
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            of {formatCurrency(amount)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-[var(--color-muted)]">
          <span>{percentage.toFixed(0)}%</span>
          <span>{formatCurrency(spent)} spent</span>
        </div>
        <div className="h-2.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${colorClass}`}
          />
        </div>
      </div>

      {/* Hover Action (Delete) */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDelete(budget.id)}
          className="p-1.5 text-[var(--color-muted)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          title="Delete Budget"
        >
          <Icons.Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}
