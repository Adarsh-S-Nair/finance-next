/**
 * Sticky topbar pinned to the main content column. Mirrors AdminTopbar:
 * hosts a portal target so each page can mount its own title/subtitle
 * locally and the topbar stays a single source of truth.
 */
export default function DeveloperTopbar() {
  return (
    <header className="sticky top-0 z-40 h-16 bg-[var(--color-content-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_15%)]">
      <div className="max-w-6xl mx-auto h-full px-8 flex items-center gap-4">
        <div
          id="developer-page-title-portal"
          className="flex flex-1 items-center min-w-0 gap-4"
        />
        <div id="developer-topbar-tools-portal" className="flex items-center gap-2" />
      </div>
    </header>
  );
}
