"use client";

import PageContainer from "../../components/PageContainer";
import ThemeToggle from "../../components/ThemeToggle";
import AccentPicker from "../../components/AccentPicker";
import Card from "../../components/ui/Card";
import { useState } from "react";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "../../components/UserProvider";
import { useAccounts } from "../../components/AccountsProvider";
import { PiBankFill } from "react-icons/pi";
import { FaUnlink, FaPlus } from "react-icons/fa";
import PlaidLinkModal from "../../components/PlaidLinkModal";

export default function SettingsPage() {
  const router = useRouter();
  const { logout, profile } = useUser();
  const { accounts, loading: accountsLoading, refreshAccounts } = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectModal, setDisconnectModal] = useState({ isOpen: false, institution: null });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);

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

  const handleDisconnectInstitution = (institution) => {
    setDisconnectModal({ isOpen: true, institution });
  };

  const handleConfirmDisconnect = async () => {
    const { institution } = disconnectModal;

    if (!institution.plaidItemId) {
      alert('Unable to disconnect: Missing Plaid item information.');
      return;
    }

    try {
      setIsDisconnecting(true);
      console.log('Disconnecting institution:', institution.name, 'plaidItemId:', institution.plaidItemId);

      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plaidItemId: institution.plaidItemId,
          userId: profile?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to disconnect');
      }

      const result = await response.json();
      console.log('Disconnect successful:', result);

      // Refresh accounts to reflect the changes
      refreshAccounts();

      // Close the modal
      setDisconnectModal({ isOpen: false, institution: null });

    } catch (error) {
      console.error('Error disconnecting institution:', error);
      alert(`Failed to disconnect ${institution.name}: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCancelDisconnect = () => {
    setDisconnectModal({ isOpen: false, institution: null });
  };

  const handleAddAccount = () => {
    setIsPlaidModalOpen(true);
  };

  return (
    <PageContainer title="Settings">
      <section aria-labelledby="appearance-heading" className="mt-4 pl-6 relative z-20">
        <h2 id="appearance-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Appearance</h2>
        <Card className="mt-3" allowOverflow={true}>
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
        </Card>
      </section>

      <section aria-labelledby="institutions-heading" className="mt-8 pl-6">
        <div className="flex items-center justify-between mb-3">
          <h2 id="institutions-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Connected Institutions</h2>
          <Button
            onClick={handleAddAccount}
            variant="ghost"
            size="icon"
            aria-label="Add Account"
            className="hover:bg-[var(--color-accent)]/10"
          >
            <FaPlus className="h-4 w-4" />
          </Button>
        </div>
        <Card className="mt-3">
          {accountsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent)] mx-auto mb-2"></div>
                <p className="text-sm text-[var(--color-muted)]">Loading institutions...</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <PiBankFill className="h-8 w-8 text-[var(--color-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--color-muted)]">No institutions connected</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((institution, index) => (
                <div key={institution.id}>
                  <div className="flex items-center gap-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {institution.logo ? (
                        <img
                          src={institution.logo}
                          alt={`${institution.name} logo`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <PiBankFill
                        className={`h-5 w-5 text-[var(--color-accent)] ${institution.logo ? 'hidden' : 'block'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--color-fg)] truncate">{institution.name}</div>
                      <div className="text-sm text-[var(--color-muted)]">
                        {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''} connected
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectInstitution(institution)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 dark:hover:text-red-400"
                    >
                      <FaUnlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                  {index < accounts.length - 1 && (
                    <div className="h-px w-full bg-[var(--color-border)]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="danger-heading" className="mt-8 pl-6">
        <h2 id="danger-heading" className="text-sm font-semibold tracking-wide text-[var(--color-muted)]">Delete Account</h2>
        <Card variant="danger" className="mt-3">
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
        </Card>
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

      {/* Disconnect Institution Modal */}
      <ConfirmDialog
        isOpen={disconnectModal.isOpen}
        onCancel={handleCancelDisconnect}
        onConfirm={handleConfirmDisconnect}
        title={`Disconnect ${disconnectModal.institution?.name}`}
        description={`Are you sure you want to disconnect ${disconnectModal.institution?.name}? This will remove all associated accounts and transaction data from your dashboard.`}
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDisconnecting}
        busyLabel="Disconnecting..."
      />

      {/* Plaid Link Modal */}
      <PlaidLinkModal
        isOpen={isPlaidModalOpen}
        onClose={() => setIsPlaidModalOpen(false)}
      />
    </PageContainer>
  );
}
