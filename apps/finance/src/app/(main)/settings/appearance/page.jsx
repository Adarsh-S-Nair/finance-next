"use client";

import ThemeToggle from "../../../../components/ThemeToggle";
import {
  SettingsSection,
  SettingsRow,
} from "../../../../components/settings/SettingsPrimitives";

export default function AppearanceSettingsPage() {
  return (
    <SettingsSection label="Appearance" first>
      <SettingsRow
        label="Theme"
        description="Switch between light and dark mode."
        control={<ThemeToggle />}
      />
    </SettingsSection>
  );
}
