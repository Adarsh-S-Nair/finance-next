"use client";

import PageContainer from "../../../components/layout/PageContainer";
import ThemeToggle from "../../../components/ThemeToggle";
import AccentPicker from "../../../components/AccentPicker";
import { useState, useEffect } from "react";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import Button from "../../../components/ui/Button";
import { supabase } from "../../../lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { PiBankFill } from "react-icons/pi";
import { FaPlus } from "react-icons/fa";
import { HiChevronDown } from "react-icons/hi2";
import { IoUnlink } from "react-icons/io5";
import { FiTool } from "react-icons/fi";
import PlaidLinkModal from "../../../components/PlaidLinkModal";
import UpgradeOverlay from "../../../components/UpgradeOverlay";
import { authFetch } from "../../../lib/api/fetch";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, profile, isPro, user, refreshProfile } = useUser();
  const { accounts, loading: accountsLoading, refreshAccounts } = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectModal, setDisconnectModal] = useState({ isOpen: false, institution: null });
  const [disconnectAccountModal, setDisconnectAccountModal] = useState({ isOpen: false, account: null, institution: null });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  // On return from Stripe Checkout (?upgraded=1), call sync endpoint as a fallback
  // in case the webhook hasn't fired yet, then refresh the profile.
  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return;

    async function syncAndRefresh() {
      try {
        await authFetch('/api/stripe/sync', { method: 'POST' });
      } catch (e) {
        // Non-fatal — best-effort sync; webhook will eventually catch up
        console.warn('[settings] stripe sync failed:', e);
      }
      await refreshProfile();
      // Remove the query param without reloading
      router.replace('/settings');
    }

    syncAndRefresh();
  }, [searchParams, refreshProfile, router]);
  const [expandedInstitutions, setExpandedInstitutions] = useState({});

  const handleResync = async () => {
    if (!confirm("Are you sure? This will reset your transaction history and trigger a full resync.")) return;
    setIsResyncing(true);
    try {
      const res = await authFetch('/api/plaid/reset-cursor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      const res = await authFetch('/api/stripe/portal', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error || 'Failed to open billing portal');
        return;
      }
      if (body.url) {
        window.location.href = body.url;
      }
    } catch (e) {
      alert(e.message || 'Failed to open billing portal');
    } finally {
      setIsPortalLoading(false);
    }
  };

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
      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
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

      const response = await authFetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plaidItemId: institution.plaidItemId,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to disconnect');
      }

      const result = await response.json();
      console.log('Disconnect successful:', result);

      refreshAccounts();
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

  const toggleInstitutionExpanded = (institutionId) => {
    setExpandedInstitutions(prev => ({
      ...prev,
      [institutionId]: !prev[institutionId]
    }));
  };

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
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to disconnect account');
      }

      const result = await response.json();
      console.log('Disconnect account successful:', result);

      refreshAccounts();
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
    if (!isPro && accounts.length >= 1) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsPlaidModalOpen(true);
  };

  const meta = user?.user_metadata ?? {};
  const firstName = profile?.first_name || meta.first_name || "";
  const lastName = profile?.last_name || meta.last_name || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ")
    || meta.name
    || meta.full_name
    || user?.email
    || "—";

  return (
    <PageContainer title="Settings">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Profile Section */}
        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Profile</h2>
          <div className="flex items-start gap-4 pb-6 border-b border-[var(--color-border)]">
            {/* Avatar */}
            <div className="flex-shrink-0 mt-1">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile avatar"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                  <span className="text-lg font-semibold text-[var(--color-accent)]">
                    {(displayName === "—" ? "?" : displayName)[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Name + Email */}
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div>
                <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Name</div>
                <div className="text-sm text-[var(--color-fg)]">
                  {displayName}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Email</div>
                <div className="text-sm text-[var(--color-fg)] truncate">{user?.email || "—"}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Subscription Section */}
        <section aria-labelledby="subscription-heading">
          <h2 id="subscription-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Subscription</h2>
          <div className="flex items-center justify-between py-3 border-b border-[var(--color-border)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-[var(--color-fg)]">Current plan</div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPro
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]'
                }`}>
                  {isPro ? 'Pro' : 'Free'}
                </span>
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">
                {isPro
                  ? 'You have access to all Pro features including budgets, investments, and unlimited bank connections.'
                  : 'Upgrade to Pro for budgets, investments, and unlimited bank connections.'}
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              {isPro ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={isPortalLoading}
                  variant="primary"
                  size="sm"
                >
                  {isPortalLoading ? 'Loading...' : 'Manage Subscription'}
                </Button>
              ) : (
                <Button
                  onClick={() => setIsUpgradeModalOpen(true)}
                  variant="primary"
                  size="sm"
                >
                  Upgrade to Pro
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Appearance</h2>
          <div className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">Theme</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Switch between light and dark mode.</div>
              </div>
              <ThemeToggle />
            </div>
            {/* overflow-visible wrapper so AccentPicker dropdown isn't clipped */}
            <div className="flex items-center justify-between py-3 overflow-visible relative z-10">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">Accent color</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Choose a highlight color for the UI.</div>
              </div>
              <AccentPicker />
            </div>
          </div>
        </section>

        {/* Connected Institutions Section */}
        <section aria-labelledby="institutions-heading">
          <div className="flex items-center justify-between mb-4">
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
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            {accountsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-accent)] mx-auto mb-2"></div>
                  <p className="text-xs text-[var(--color-muted)]">Loading...</p>
                </div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex items-center justify-center py-6">
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
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--color-surface)]/40"
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
                            className="p-1.5 rounded text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] transition-all"
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
                            {institution.accounts.map((account) => (
                              <div
                                key={account.id}
                                className="group/account flex items-center gap-3 py-2 pl-14 pr-4 hover:bg-[var(--color-surface)]/40 transition-colors"
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
                                  className="p-1.5 rounded text-[var(--color-muted)] opacity-0 group-hover/account:opacity-100 hover:text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] transition-all"
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
          </div>
        </section>

        {/* Session Section */}
        <section aria-labelledby="session-heading">
          <h2 id="session-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Session</h2>
          <div className="flex items-center justify-between py-3 border-b border-[var(--color-border)]">
            <div>
              <div className="text-sm font-medium text-[var(--color-fg)]">Sign out</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">Sign out of your account on this device.</div>
            </div>
            <Button
              onClick={logout}
              variant="primary"
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Danger Zone</h2>
          <div className="flex items-center justify-between py-3 border-b border-[color-mix(in_oklab,var(--color-danger),transparent_80%)]">
            <div>
              <div className="text-sm font-medium text-[var(--color-fg)]">Delete account</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">Permanently delete your account and all associated data.</div>
            </div>
            <Button
              onClick={() => setConfirmOpen(true)}
              variant="danger"
              size="sm"
            >
              Delete Account
            </Button>
          </div>
        </section>

        {/* Debug Tools */}
        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === 'true' && (
          <section aria-labelledby="debug-heading">
            <h2 id="debug-heading" className="text-sm font-medium text-[var(--color-muted)] mb-4 uppercase tracking-wider">Debug Tools</h2>
            <div className="flex items-center justify-between py-3 border-b border-amber-500/20">
              <div>
                <div className="text-sm font-medium text-amber-600 dark:text-amber-500 flex items-center gap-2">
                  <FiTool className="h-3.5 w-3.5" />
                  Resync Transactions
                </div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">
                  Force a full re-download of all transaction history from Plaid.
                </div>
              </div>
              <button
                onClick={handleResync}
                disabled={isResyncing}
                className="text-xs font-medium text-amber-600 dark:text-amber-500 hover:underline transition-colors disabled:opacity-50"
              >
                {isResyncing ? 'Syncing...' : 'Resync All'}
              </button>
            </div>
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
        onUpgradeNeeded={() => {
          setIsPlaidModalOpen(false);
          setIsUpgradeModalOpen(true);
        }}
      />

      {/* Upgrade Modal */}
      <UpgradeOverlay
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </PageContainer>
  );
}
