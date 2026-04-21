"use client";

import React from "react";
import Card from "../ui/Card";

export default function PlaceholderCard({ title, description, width = "full" }) {
  return (
    <Card width={width}>
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">{title}</div>
      </div>
      <div className="h-32 w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[var(--color-muted)] mb-2">
            {description}
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            Coming soon
          </div>
        </div>
      </div>
    </Card>
  );
}
