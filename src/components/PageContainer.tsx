"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SITE_PAGES } from "../config/site-pages";

type Props = {
  title?: string;
  documentTitle?: string; // Deprecated: handled by layout metadata
  children: ReactNode;
  action?: ReactNode;
  padding?: string;
};

export default function PageContainer({ title, children, action, padding = "py-6" }: Props) {
  const pathname = usePathname();

  // Determine the visual title
  // 1. Use explicit title prop if provided
  // 2. Fallback to config based on pathname
  let displayTitle = title;

  if (!displayTitle && pathname) {
    const pageConfig = SITE_PAGES[pathname as keyof typeof SITE_PAGES];
    if (pageConfig?.header) {
      displayTitle = pageConfig.header;
    }
  }

  return (
    <div className={padding}>
      {(displayTitle || action) && (
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--color-border)]">
          {displayTitle && (
            <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
              {displayTitle}
            </h1>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}


