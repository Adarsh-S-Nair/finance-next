"use client";

import React from "react";
import Card from "../ui/Card";

export default function SpendingBreakdownCard() {
  return (
    <Card width="1/3">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Spending Breakdown</div>
      </div>

      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
          <div className="text-2xl text-[var(--color-muted)]">📊</div>
        </div>
        <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Coming Soon</h3>
        <p className="text-sm text-[var(--color-muted)]">Spending breakdown by category will be available here</p>
      </div>
    </Card>
  );
}

