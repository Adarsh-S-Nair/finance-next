"use client";

import React, { ReactNode } from "react";

type Props = { 
  title?: string; 
  children: ReactNode;
  action?: ReactNode;
};

export default function PageContainer({ title, children, action }: Props) {
  return (
    <div className="py-6">
      {action && (
        <div className="flex items-center justify-end mb-6 pb-3 border-b border-[var(--color-border)]">
          <div className="ml-auto">{action}</div>
        </div>
      )}
      {children}
    </div>
  );
}


