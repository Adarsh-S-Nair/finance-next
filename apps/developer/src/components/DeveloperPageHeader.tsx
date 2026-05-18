"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
};

/**
 * Portals a page title (and optional subtitle) into the DeveloperTopbar's
 * #developer-page-title-portal slot — same pattern as
 * apps/admin/AdminPageHeader.
 */
export default function DeveloperPageHeader({ title, subtitle }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById("developer-page-title-portal");
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
