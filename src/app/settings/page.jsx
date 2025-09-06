import PageContainer from "../../components/PageContainer";
import ThemeToggle from "../../components/ThemeToggle";
import AccentPicker from "../../components/AccentPicker";

export default function SettingsPage() {
  return (
    <PageContainer title="Settings">
      <div className="mt-4 border-b border-[var(--color-border)] pb-3">
        <p className="text-sm text-[var(--color-muted)]">Configure how Zentari looks on your device.</p>
      </div>

      <section aria-labelledby="appearance-heading" className="mt-4 pl-6">
        <h2 id="appearance-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Appearance</h2>
        <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] p-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-sm text-[var(--color-muted)]">Switch between light and dark mode.</div>
            </div>
            <ThemeToggle />
          </div>
          <div className="my-2 h-px w-full bg-[var(--color-border)]" />
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Accent color</div>
              <div className="text-sm text-[var(--color-muted)]">Choose a highlight color for the UI.</div>
            </div>
            <AccentPicker inline />
          </div>
        </div>
      </section>
    </PageContainer>
  );
}


