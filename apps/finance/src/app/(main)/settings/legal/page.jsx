"use client";

import { useRouter } from "next/navigation";
import {
  SettingsSection,
  SettingsActionRow,
} from "../../../../components/settings/SettingsPrimitives";

export default function LegalSettingsPage() {
  const router = useRouter();

  return (
    <SettingsSection label="Legal" first>
      <SettingsActionRow
        label="Terms of Use"
        description="The rules for using the service."
        onClick={() => router.push("/docs/terms")}
        trailing={<span className="text-base leading-none">&#8250;</span>}
      />
      <SettingsActionRow
        label="Privacy Policy"
        description="How we handle your data."
        onClick={() => router.push("/docs/privacy")}
        trailing={<span className="text-base leading-none">&#8250;</span>}
      />
    </SettingsSection>
  );
}
