"use client";

import React, { ReactNode, useEffect } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  padding?: string;
};

export default function PageContainer({ title, children, action, padding = "py-6" }: Props) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (title && title.trim().length > 0) {
      document.title = `Zentari | ${title}`;
    } else {
      document.title = "Zentari";
    }
  }, [title]);

  return (
    <div className={padding}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--color-border)]">
          {title && (
            <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
              {title}
            </h1>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}


