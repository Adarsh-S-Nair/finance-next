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
import { FiTool } from "react-icons/fi";
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
  const [isResyncing, setIsResyncing] = useState(false);

  const handleResync = async () => {
    if (!confirm("Are you sure? This will reset your transaction history and trigger a full resync.")) return;
    setIsResyncing(true);
    try {
      const res = await fetch('/api/plaid/reset-cursor', {
        method: 'POST',
        body: JSON.stringify({ userId: profile.id })
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
      <div className="max-w-3xl space-y-8">
        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-sm font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Appearance</h2>
          <Card>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">Theme</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Switch between light and dark mode.</div>
              </div>
              <ThemeToggle />
            </div>
            <div className="h-px w-full bg-[var(--color-border)]" />
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">Accent color</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Choose a highlight color for the UI.</div>
              </div>
              <AccentPicker />
            </div>
          </Card>
        </section>

        <section aria-labelledby="institutions-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="institutions-heading" className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">Connected Institutions</h2>
            <Button
              onClick={handleAddAccount}
              variant="ghost"
              size="sm"
              className="text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 text-xs h-8"
            >
              <FaPlus className="h-3 w-3 mr-1.5" />
              Add Account
            </Button>
          </div>
          <Card>
            {accountsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-accent)] mx-auto mb-2"></div>
                  <p className="text-xs text-[var(--color-muted)]">Loading institutions...</p>
                </div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-2 border border-[var(--color-border)]">
                    <PiBankFill className="h-5 w-5 text-[var(--color-muted)]" />
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">No institutions connected</p>
                  <Button
                    onClick={handleAddAccount}
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs h-8"
                  >
                    Connect Bank
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {accounts.map((institution) => (
                  <div key={institution.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="w-9 h-9 rounded-full bg-white border border-[var(--color-border)] flex items-center justify-center overflow-hidden flex-shrink-0 p-1.5">
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
                        className={`h-4 w-4 text-[var(--color-accent)] ${institution.logo ? 'hidden' : 'block'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-fg)] truncate">{institution.name}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''} connected
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => handleDisconnectInstitution(institution)}
                      className="text-[var(--color-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                      title="Disconnect"
                    >
                      <FaUnlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-sm font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Danger Zone</h2>
          <Card variant="danger">
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-red-600 dark:text-red-400">Delete account</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">This will permanently delete your account and all associated data.</div>
              </div>
              <Button
                aria-label="Delete account"
                title="Delete account"
                variant="danger"
                size="sm"
                className="text-xs h-8"
                onClick={() => setConfirmOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          </Card>
        </section>

        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === 'true' && (
          <section aria-labelledby="debug-heading">
            <h2 id="debug-heading" className="text-sm font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Debug Tools</h2>
            <Card variant="default" className="border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-amber-600 dark:text-amber-500 flex items-center gap-2">
                    <FiTool className="h-4 w-4" />
                    Resync Transactions
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    Force a full re-download of all transaction history from Plaid.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResync}
                  disabled={isResyncing}
                  className="border-amber-500/20 hover:bg-amber-500/10 text-amber-600 dark:text-amber-500 text-xs h-8"
                >
                  {isResyncing ? 'Syncing...' : 'Resync All'}
                </Button>
              </div>
            </Card>
          </section>
        )}
      </div>

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
