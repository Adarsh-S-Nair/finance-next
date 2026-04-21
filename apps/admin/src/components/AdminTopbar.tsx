"use client";

/**
 * Sticky topbar pinned to the main content column (not the sidebar).
 * Hosts the #admin-page-title-portal target — each page mounts an
 * <AdminPageHeader> that portals its title/subtitle here, so the topbar
 * stays a single source of truth for page headings across the admin app.
 */
export default function AdminTopbar() {
  return (
    <header className="sticky top-0 z-40 h-16 bg-[var(--color-content-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_15%)]">
      <div className="max-w-6xl mx-auto h-full px-8 flex items-center gap-4">
        <div
          id="admin-page-title-portal"
          className="flex flex-1 items-center min-w-0 gap-4"
        />
        <div id="admin-topbar-tools-portal" className="flex items-center gap-2" />
      </div>
    </header>
  );
}
