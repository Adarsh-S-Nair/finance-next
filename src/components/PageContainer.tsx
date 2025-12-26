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
        <div className="hidden md:flex items-center justify-between mb-6 pb-3">
          {displayTitle && (
            <h1
              className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
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


