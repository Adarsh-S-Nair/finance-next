"use client";

import React, { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";

type Props = { title?: string; children: ReactNode };

export default function PageContainer({ title, children }: Props) {
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
      {computed && <h1 className="text-xl font-semibold tracking-tight">{computed}</h1>}
      {children}
    </div>
  );
}


