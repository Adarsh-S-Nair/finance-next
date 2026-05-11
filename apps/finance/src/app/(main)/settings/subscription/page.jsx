"use client";

import { useState } from "react";
import { useUser } from "../../../../components/providers/UserProvider";
import { authFetch } from "../../../../lib/api/fetch";
import UpgradeOverlay from "../../../../components/UpgradeOverlay";
import {
  SettingsSection,
  SettingsActionRow,
} from "../../../../components/settings/SettingsPrimitives";

export default function SubscriptionSettingsPage() {
  const { isPro } = useUser();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      const res = await authFetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error || "Failed to open billing portal");
        return;
      }
      if (body.url) {
        window.location.href = body.url;
      }
    } catch (e) {
      alert(e.message || "Failed to open billing portal");
    } finally {
      setIsPortalLoading(false);
    }
  };

  return (
    <>
      <SettingsSection label="Subscription" first>
        <SettingsActionRow
          label="Current plan"
          description={
            isPro
              ? "You have access to all Pro features including budgets, investments, and unlimited bank connections."
              : "Upgrade to Pro for budgets, investments, and unlimited bank connections."
          }
          onClick={isPro ? handleManageSubscription : () => setIsUpgradeModalOpen(true)}
          disabled={isPortalLoading}
          trailing={
            <>
              <span className="text-sm text-[var(--color-fg)]">
                {isPortalLoading ? "Loading…" : isPro ? "Pro" : "Free"}
              </span>
              <span className="text-base leading-none">&#8250;</span>
            </>
          }
        />
      </SettingsSection>

      <UpgradeOverlay
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
}
