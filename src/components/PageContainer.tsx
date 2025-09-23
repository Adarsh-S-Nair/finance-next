"use client";

import React, { ReactNode, useEffect } from "react";

type Props = { 
  title?: string; 
  children: ReactNode;
  action?: ReactNode;
};

export default function PageContainer({ title, children, action }: Props) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (title && title.trim().length > 0) {
      document.title = `Zentari | ${title}`;
    } else {
      document.title = "Zentari";
    }
  }, [title]);

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


