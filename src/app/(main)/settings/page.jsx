"use client";

import PageContainer from "../../../components/PageContainer";
import ThemeToggle from "../../../components/ThemeToggle";
import AccentPicker from "../../../components/AccentPicker";
import Card from "../../../components/ui/Card";
import { useState } from "react";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import Button from "../../../components/ui/Button";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "../../../components/UserProvider";
import { useAccounts } from "../../../components/AccountsProvider";
import { PiBankFill } from "react-icons/pi";
import { FaPlus } from "react-icons/fa";
import { HiChevronDown } from "react-icons/hi2";
import { IoUnlink } from "react-icons/io5";
import { FiTool } from "react-icons/fi";
import PlaidLinkModal from "../../../components/PlaidLinkModal";

export default function SettingsPage() {
  const router = useRouter();
  const { logout, profile } = useUser();
  const { accounts, loading: accountsLoading, refreshAccounts } = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectModal, setDisconnectModal] = useState({ isOpen: false, institution: null });
  const [disconnectAccountModal, setDisconnectAccountModal] = useState({ isOpen: false, account: null, institution: null });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [expandedInstitutions, setExpandedInstitutions] = useState({});

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

  // Toggle expanded state for an institution
  const toggleInstitutionExpanded = (institutionId) => {
    setExpandedInstitutions(prev => ({
      ...prev,
      [institutionId]: !prev[institutionId]
    }));
  };

  // Handle disconnect individual account
  const handleDisconnectAccount = (account, institution) => {
    setDisconnectAccountModal({ isOpen: true, account, institution });
  };

  const handleConfirmDisconnectAccount = async () => {
    const { account, institution } = disconnectAccountModal;

    if (!account?.id) {
      alert('Unable to disconnect: Missing account information.');
      return;
    }

    try {
      setIsDisconnecting(true);
      console.log('Disconnecting account:', account.name, 'from institution:', institution?.name);

      const response = await fetch('/api/plaid/disconnect-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: account.id,
          userId: profile?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to disconnect account');
      }

      const result = await response.json();
      console.log('Disconnect account successful:', result);

      // Refresh accounts to reflect the changes
      refreshAccounts();

      // Close the modal
      setDisconnectAccountModal({ isOpen: false, account: null, institution: null });

    } catch (error) {
      console.error('Error disconnecting account:', error);
      alert(`Failed to disconnect ${account.name}: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCancelDisconnectAccount = () => {
    setDisconnectAccountModal({ isOpen: false, account: null, institution: null });
  };

  const handleAddAccount = () => {
    setIsPlaidModalOpen(true);
  };

  return (
    <PageContainer title="Settings">
      <div className="max-w-3xl space-y-8">
        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-sm font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Appearance</h2>
          <Card allowOverflow className="relative z-10">
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
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-accent)] mx-auto mb-2"></div>
                  <p className="text-xs text-[var(--color-muted)]">Loading...</p>
                </div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-2 border border-[var(--color-border)]">
                    <PiBankFill className="h-4 w-4 text-[var(--color-muted)]" />
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">No institutions connected</p>
                  <Button
                    onClick={handleAddAccount}
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs h-7"
                  >
                    Connect Bank
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {accounts.map((institution) => {
                  const isExpanded = expandedInstitutions[institution.id];
                  return (
                    <div key={institution.id} className="group">
                      {/* Institution Header Row */}
                      <div 
                        className="flex items-center gap-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--color-surface)]/40"
                        onClick={() => toggleInstitutionExpanded(institution.id)}
                      >
                        <div className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {institution.logo ? (
                            <img
                              src={institution.logo}
                              alt={`${institution.name} logo`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <PiBankFill
                            className={`h-3.5 w-3.5 text-[var(--color-accent)] ${institution.logo ? 'hidden' : 'block'}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--color-fg)] truncate">{institution.name}</div>
                          <div className="text-[11px] text-[var(--color-muted)]">
                            {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnectInstitution(institution);
                            }}
                            className="p-1.5 rounded text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                            title="Disconnect all accounts"
                          >
                            <IoUnlink className="h-3.5 w-3.5" />
                          </button>
                          <div className="p-1.5 text-[var(--color-muted)]">
                            <HiChevronDown 
                              className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Animated Accounts List */}
                      <div 
                        className={`grid transition-all duration-200 ease-out ${
                          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="pb-2">
                            {institution.accounts.map((account, idx) => (
                              <div 
                                key={account.id} 
                                className="group/account flex items-center gap-3 py-2 pl-10 pr-1 hover:bg-[var(--color-surface)]/40 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--color-fg)] truncate">
                                      {account.name}
                                    </span>
                                    {account.mask && (
                                      <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                                        {account.mask}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] text-[var(--color-muted)] capitalize">
                                      {account.type}
                                    </span>
                                    {account.balance !== undefined && (
                                      <>
                                        <span className="text-[var(--color-muted)]">·</span>
                                        <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                                          ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </>
                                    )}
                                    {account.createdAt && (
                                      <>
                                        <span className="text-[var(--color-muted)]">·</span>
                                        <span className="text-[11px] text-[var(--color-muted)]">
                                          Added {new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnectAccount(account, institution);
                                  }}
                                  className="p-1.5 rounded text-[var(--color-muted)] opacity-0 group-hover/account:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                  title={`Disconnect ${account.name}`}
                                >
                                  <IoUnlink className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-sm font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Account</h2>
          <Card>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">Sign out</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Sign out of your account on this device.</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
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
        confirmLabel="Disconnect All"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDisconnecting}
        busyLabel="Disconnecting..."
      />

      {/* Disconnect Individual Account Modal */}
      <ConfirmDialog
        isOpen={disconnectAccountModal.isOpen}
        onCancel={handleCancelDisconnectAccount}
        onConfirm={handleConfirmDisconnectAccount}
        title={`Disconnect ${disconnectAccountModal.account?.name || 'Account'}`}
        description={
          disconnectAccountModal.institution?.accounts?.length === 1
            ? `This is the last account connected to ${disconnectAccountModal.institution?.name}. Disconnecting will completely remove the institution and all associated transaction data. Are you sure?`
            : `Are you sure you want to disconnect "${disconnectAccountModal.account?.name}"? This will remove all transactions and history for this account from your dashboard.`
        }
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
