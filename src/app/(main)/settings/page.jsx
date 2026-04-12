"use client";

import PageContainer from "../../../components/layout/PageContainer";
import ThemeToggle from "../../../components/ThemeToggle";
import { useState, useEffect } from "react";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { supabase } from "../../../lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { PiBankFill } from "react-icons/pi";
import { FiPlus, FiTool } from "react-icons/fi";
import { IoUnlink } from "react-icons/io5";
import { LuLogOut } from "react-icons/lu";
import AddAccountOverlay from "../../../components/AddAccountOverlay";
import UpgradeOverlay from "../../../components/UpgradeOverlay";
import { authFetch } from "../../../lib/api/fetch";

// Section wrapper: small uppercase heading + optional action, with a trailing
// border-b separator so every section on the page feels consistent.
function SettingsSection({ label, action, children }) {
  return (
    <section className="py-5 border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Static row: label + optional description on the left, control on the right.
// Used for non-actionable rows (Theme toggle, etc.).
function SettingsRow({ label, description, control, overflowVisible = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3.5 ${overflowVisible ? 'overflow-visible relative z-10' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{description}</div>
        )}
      </div>
      {control && <div className="flex-shrink-0">{control}</div>}
    </div>
  );
}

// Clickable action row — whole row is the tap target. Optional trailing
// content (value text, chevron, or icon) goes on the right.
function SettingsActionRow({ label, description, onClick, trailing, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full gap-4 py-3.5 -mx-2 px-2 rounded-md text-left transition-colors hover:bg-[var(--color-surface-alt)]/60 disabled:opacity-60 disabled:cursor-default"
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg)]'}`}>
          {label}
        </div>
        {description && (
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{description}</div>
        )}
      </div>
      {trailing && (
        <div className="flex-shrink-0 flex items-center gap-2 text-[var(--color-muted)]">
          {trailing}
        </div>
      )}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { logout, profile, isPro, user, refreshProfile } = useUser();
  const { accounts, loading: accountsLoading, refreshAccounts } = useAccounts();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectAccountModal, setDisconnectAccountModal] = useState({ isOpen: false, account: null, institution: null });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

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
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (typeof window !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-')) localStorage.removeItem(key);
        }
      }
      logout();
      router.push("/");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

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
    setIsAddAccountOpen(true);
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
      <div>

        {/* Profile Section */}
        <SettingsSection label="Profile">
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
              <div className="text-sm font-medium text-[var(--color-fg)] truncate">{displayName}</div>
              <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">{user?.email || "—"}</div>
            </div>
          </div>
        </SettingsSection>

        {/* Subscription Section */}
        <SettingsSection label="Subscription">
          <SettingsActionRow
            label="Current plan"
            description={isPro
              ? 'You have access to all Pro features including budgets, investments, and unlimited bank connections.'
              : 'Upgrade to Pro for budgets, investments, and unlimited bank connections.'}
            onClick={isPro ? handleManageSubscription : () => setIsUpgradeModalOpen(true)}
            disabled={isPortalLoading}
            trailing={
              <>
                <span className="text-sm text-[var(--color-fg)]">
                  {isPortalLoading ? 'Loading…' : (isPro ? 'Pro' : 'Free')}
                </span>
                <span className="text-base leading-none">&#8250;</span>
              </>
            }
          />
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection label="Appearance">
          <SettingsRow
            label="Theme"
            description="Switch between light and dark mode."
            control={<ThemeToggle />}
          />
        </SettingsSection>

        {/* Connected Institutions Section */}
        <SettingsSection
          label="Connected Institutions"
          action={
            <button
              type="button"
              onClick={handleAddAccount}
              aria-label="Add account"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
            >
              <FiPlus className="h-5 w-5" />
            </button>
          }
        >
          {accountsLoading ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-fg)]/40 mx-auto mb-2"></div>
              <p className="text-xs text-[var(--color-muted)]">Loading…</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--color-muted)] mb-2">No institutions connected</p>
              <button
                type="button"
                onClick={handleAddAccount}
                className="text-xs font-medium text-[var(--color-fg)] hover:opacity-70 transition-opacity"
              >
                Connect a bank &#8250;
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {accounts.map((institution) => (
                <div key={institution.id}>
                  {/* Institution sub-header */}
                  <div className="mb-1 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      {institution.name}
                    </span>
                  </div>

                  {/* Accounts */}
                  <div>
                    {institution.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center overflow-hidden flex-shrink-0">
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
                              className={`h-4 w-4 text-[var(--color-muted)] ${institution.logo ? 'hidden' : 'block'}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                                {account.name}
                              </span>
                              {account.mask && (
                                <span className="text-xs text-[var(--color-muted)] tabular-nums flex-shrink-0">
                                  ··{account.mask}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-[var(--color-muted)] capitalize">
                                {account.type}
                              </span>
                              {account.balance !== undefined && (
                                <>
                                  <span className="text-[var(--color-muted)] text-xs">·</span>
                                  <span className="text-xs text-[var(--color-muted)] tabular-nums">
                                    ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDisconnectAccount(account, institution)}
                          aria-label={`Disconnect ${account.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-danger)] flex-shrink-0"
                        >
                          <IoUnlink className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        {/* Session Section */}
        <SettingsSection label="Session">
          <SettingsRow
            label="Sign out"
            description="Sign out of your account on this device."
            control={
              <button
                onClick={async () => {
                  await Promise.race([
                    supabase.auth.signOut(),
                    new Promise((resolve) => setTimeout(resolve, 3000)),
                  ]);
                  if (typeof window !== 'undefined') {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key && key.startsWith('sb-')) localStorage.removeItem(key);
                    }
                  }
                  logout();
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

        {/* Danger Zone */}
        <SettingsSection label="Danger Zone">
          <SettingsActionRow
            label="Delete account"
            description="Permanently delete your account and all associated data."
            onClick={() => setConfirmOpen(true)}
            danger
            trailing={<span className="text-base leading-none">&#8250;</span>}
          />
        </SettingsSection>

        {/* Debug Tools */}
        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === 'true' && (
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
                  {isResyncing ? 'Syncing…' : 'Resync'}
                </span>
              }
            />
          </SettingsSection>
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

      {/* Add Account Overlay — same one the topbar opens */}
      <AddAccountOverlay
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
      />

      {/* Upgrade Modal */}
      <UpgradeOverlay
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </PageContainer>
  );
}
