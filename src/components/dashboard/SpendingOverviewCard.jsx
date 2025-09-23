"use client";

import React from 'react';
import Card from '../ui/Card';

export default function SpendingOverviewCard() {
  return (
    <Card width="1/3">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
      </div>
      
      <div className="h-40 w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[var(--color-muted)] mb-2">
            Coming Soon
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            Detailed spending analysis will be available here
          </div>
        </div>
      </div>
    </Card>
  );
}
