"use client";

import React, { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  action?: ReactNode;
  prefix?: ReactNode;
  show?: boolean;
  className?: string;
};

export default function PageHeader({
  title,
  action,
  prefix,
  show = true,
  className = "",
}: Props) {
  if (!show || (!title && !action && !prefix)) return null;

  return (
    <div className={`hidden md:flex items-center justify-between mb-6 pb-3 gap-4 ${className}`.trim()}>
      <div className="min-w-0">
        {prefix && (
          <div className="text-sm text-[var(--color-muted)] mb-1">{prefix}</div>
        )}
        {title && (
          <h1 className="text-lg font-normal tracking-normal text-[var(--color-fg)] truncate">
            {title}
          </h1>
        )}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
