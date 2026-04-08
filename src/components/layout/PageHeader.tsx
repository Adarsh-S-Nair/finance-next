"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  title?: ReactNode;
  action?: ReactNode;
  prefix?: ReactNode;
  show?: boolean;
};

export default function PageHeader({
  title,
  action,
  prefix,
  show = true,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!show || (!title && !action && !prefix)) return null;

  const content = (
    <>
      <div className="min-w-0 flex-1">
        {prefix && (
          <div className="text-xs text-[var(--color-muted)] mb-0.5">{prefix}</div>
        )}
        {title && (
          <h1 className="text-[15px] font-medium tracking-tight text-[var(--color-fg)] truncate">
            {title}
          </h1>
        )}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </>
  );

  // Portal into topbar on desktop
  if (mounted) {
    const portalRoot = document.getElementById("page-title-portal");
    if (portalRoot) {
      return createPortal(content, portalRoot);
    }
  }

  // Fallback: render inline (shouldn't happen normally since topbar is always mounted)
  return (
    <div className="hidden md:flex items-center justify-between mb-6 gap-4">
      {content}
    </div>
  );
}
