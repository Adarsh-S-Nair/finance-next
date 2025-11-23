"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PageToolbar({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById("page-toolbar-portal");
  if (!portalRoot) return null;

  return (
    <>
      {createPortal(
        <div className="w-full bg-[var(--color-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-bg),transparent_6%)]">
          <div className="mx-auto max-w-[1400px] px-4 py-2">
            {children}
          </div>
        </div>,
        portalRoot
      )}
      {/* Spacer to prevent content overlap */}
      <div className="h-[60px]" aria-hidden="true" />
    </>
  );
}
