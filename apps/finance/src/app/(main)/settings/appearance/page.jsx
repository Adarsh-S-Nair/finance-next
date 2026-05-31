"use client";

import ThemePicker from "../../../../components/settings/ThemePicker";
import { SettingsSection } from "../../../../components/settings/SettingsPrimitives";

export default function AppearanceSettingsPage() {
  return (
    <SettingsSection label="Appearance" first>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-fg)]">Theme</p>
          <p className="text-xs text-[var(--color-muted)]">
            Choose how the app looks. Your choice is saved to your account.
          </p>
        </div>
        <ThemePicker />
      </div>
    </SettingsSection>
  );
}
