"use client";

import React, { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";

type Props = { 
  title?: string; 
  children: ReactNode;
  action?: ReactNode;
};

export default function PageContainer({ title, children, action }: Props) {
  const pathname = usePathname();
  const computed = useMemo(() => {
    if (title) return title;
    if (!pathname) return "";
    const seg = pathname.split("/").filter(Boolean)[0] || "";
    if (!seg) return "";
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }, [pathname, title]);

  return (
    <div className="py-6">
      {(computed || action) && (
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--color-border)]">
          {computed && <h1 className="text-xl font-semibold tracking-tight">{computed}</h1>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}


