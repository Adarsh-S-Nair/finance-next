"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { FiTool } from "react-icons/fi";
import { ConfirmOverlay } from "@zervo/ui";
import { supabase } from "../../../../lib/supabase/client";
import { useUser } from "../../../../components/providers/UserProvider";
import { authFetch } from "../../../../lib/api/fetch";
import {
  SettingsSection,
  SettingsRow,
  SettingsActionRow,
} from "../../../../components/settings/SettingsPrimitives";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { logout, profile, user } = useUser();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  const meta = user?.user_metadata ?? {};
  const firstName = profile?.first_name || meta.first_name || "";
  const lastName = profile?.last_name || meta.last_name || "";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    meta.name ||
    meta.full_name ||
    user?.email ||
    "—";

  async function signOutEverywhere() {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    if (typeof window !== "undefined") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-")) localStorage.removeItem(key);
      }
    }
    logout();
  }

  async function handleDeleteAccount() {
    try {
      setBusy(true);
      const res = await authFetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to delete account");
      }
      await signOutEverywhere();
      router.push("/");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const handleResync = async () => {
    if (
      !confirm(
        "Are you sure? This will reset your transaction history and trigger a full resync.",
      )
    )
      return;
    setIsResyncing(true);
    try {
      const res = await authFetch("/api/plaid/reset-cursor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to reset");
      alert("Resync started. Please wait a few moments for transactions to update.");
      router.refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setIsResyncing(false);
    }
  };

  return (
    <>
      <SettingsSection label="Profile" first>
        <div className="flex items-center gap-4 py-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Profile avatar"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center flex-shrink-0">
              <span className="text-base font-medium text-[var(--color-fg)]">
                {(displayName === "—" ? "?" : displayName)[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--color-fg)] truncate">
              {displayName}
            </div>
            <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
              {user?.email || "—"}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection label="Session">
        <SettingsRow
          label="Sign out"
          description="Sign out of your account on this device."
          control={
            <button
              onClick={async () => {
                await signOutEverywhere();
                router.replace("/");
              }}
              aria-label="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
            >
              <LuLogOut className="h-4 w-4" />
            </button>
          }
        />
      </SettingsSection>

      <SettingsSection label="Danger Zone">
        <SettingsActionRow
          label="Delete account"
          description="Permanently delete your account and all associated data."
          onClick={() => setConfirmOpen(true)}
          danger
          trailing={<span className="text-base leading-none">&#8250;</span>}
        />
      </SettingsSection>

      {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true" && (
        <SettingsSection label="Debug Tools">
          <SettingsActionRow
            label={
              <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <FiTool className="h-3.5 w-3.5" />
                Resync transactions
              </span>
            }
            description="Force a full re-download of all transaction history from Plaid."
            onClick={handleResync}
            disabled={isResyncing}
            trailing={
              <span className="text-sm text-amber-600 dark:text-amber-500">
                {isResyncing ? "Syncing…" : "Resync"}
              </span>
            }
          />
        </SettingsSection>
      )}

      <ConfirmOverlay
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await handleDeleteAccount();
          setConfirmOpen(false);
        }}
        title="Delete account"
        description="This action cannot be undone."
        confirmLabel="Delete"
        busyLabel="Deleting..."
        cancelLabel="Cancel"
        variant="danger"
        requiredText="delete my account"
        showRequiredTextUppercase
        busy={busy}
      />
    </>
  );
}
