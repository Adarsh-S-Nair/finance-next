"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SITE_PAGES } from "../../config/site-pages";
import PageHeader from "./PageHeader";

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  documentTitle?: string; // Deprecated: handled by layout metadata
  children: ReactNode;
  action?: ReactNode;
  frame?: "default" | "toolbar";
  padding?: string; // Deprecated: prefer `frame`
  showHeader?: boolean;
};

const FRAME_CLASS: Record<NonNullable<Props["frame"]>, string> = {
  default: "pb-6",
  toolbar: "pt-16 pb-6",
};

export default function PageContainer({
  title,
  subtitle,
  children,
  action,
  frame = "default",
  padding,
  showHeader = true,
}: Props) {
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

  const frameClass = padding ?? FRAME_CLASS[frame];

  return (
    <div className={frameClass}>
      <PageHeader title={displayTitle} subtitle={subtitle} action={action} show={showHeader} />
      {children}
    </div>
  );
}
