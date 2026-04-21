"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
};

/**
 * Portals a page title (and optional subtitle) into the AdminTopbar's
 * #admin-page-title-portal slot. Mirrors the finance app's PageHeader
 * pattern so each page declares its own title locally and the topbar
 * just acts as a rendering target.
 */
export default function AdminPageHeader({ title, subtitle }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById("admin-page-title-portal");
  if (!portalRoot) return null;

  return createPortal(
    <div className="min-w-0 flex-1">
      <h1 className="text-base font-medium tracking-tight text-[var(--color-fg)] truncate leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[11px] text-[var(--color-muted)] truncate leading-tight mt-0.5">
          {subtitle}
        </p>
      )}
    </div>,
    portalRoot,
  );
}
