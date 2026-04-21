import { ThemeControls } from "./ThemeControls";

export const dynamic = "force-static";

export default function SettingsPage() {
  return (
    <>
      <header className="mb-10">
        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Preferences for this admin console. Only affects your browser.
        </p>
      </header>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
          Appearance
        </h2>
        <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-fg)]">Theme</div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Switch between light and dark mode. Your choice is saved to this browser.
              </p>
            </div>
            <ThemeControls />
          </div>
        </div>
      </section>
    </>
  );
}
