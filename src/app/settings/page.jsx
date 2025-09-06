"use client";

import PageContainer from "../../components/PageContainer";
import ThemeToggle from "../../components/ThemeToggle";
import AccentPicker from "../../components/AccentPicker";
import { useState } from "react";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "../../components/UserProvider";

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useUser();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDeleteAccount() {
    try {
      setBusy(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to delete account");
      }
      logout(); // Reset theme and accent immediately
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      // Optionally add toast here later
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer title="Settings">
      <section aria-labelledby="appearance-heading" className="mt-4 pl-6">
        <h2 id="appearance-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Appearance</h2>
        <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] p-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-sm text-[var(--color-muted)] hidden sm:block">Switch between light and dark mode.</div>
            </div>
            <ThemeToggle />
          </div>
          <div className="my-2 h-px w-full bg-[var(--color-border)]" />
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Accent color</div>
              <div className="text-sm text-[var(--color-muted)] hidden sm:block">Choose a highlight color for the UI.</div>
            </div>
            <AccentPicker />
          </div>
        </div>
      </section>

      <section aria-labelledby="danger-heading" className="mt-8 pl-6">
        <h2 id="danger-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Delete Account</h2>
        <div className="mt-3 rounded-md border border-[color-mix(in_oklab,var(--color-danger),transparent_80%)] bg-[color-mix(in_oklab,var(--color-danger),transparent_96%)] p-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Delete account</div>
              <div className="text-sm text-[var(--color-muted)] hidden sm:block">This will permanently delete your account and all associated data.</div>
            </div>
            <Button
              aria-label="Delete account"
              title="Delete account"
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
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
    </PageContainer>
  );
}


