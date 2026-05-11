"use client";

import { useState } from "react";
import { PiBankFill } from "react-icons/pi";
import { FiPlus } from "react-icons/fi";
import { IoUnlink } from "react-icons/io5";
import { ConfirmOverlay } from "@zervo/ui";
import { useUser } from "../../../../components/providers/UserProvider";
import { useAccounts } from "../../../../components/providers/AccountsProvider";
import AddAccountOverlay from "../../../../components/AddAccountOverlay";
import UpgradeOverlay from "../../../../components/UpgradeOverlay";
import { SettingsSection } from "../../../../components/settings/SettingsPrimitives";

export default function InstitutionsSettingsPage() {
  const { isPro } = useUser();
  const { accounts, loading: accountsLoading, refreshAccounts } = useAccounts();
  const [disconnectAccountModal, setDisconnectAccountModal] = useState({
    isOpen: false,
    account: null,
    institution: null,
  });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleAddAccount = () => {
    if (!isPro && accounts.length >= 1) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsAddAccountOpen(true);
  };

  const handleDisconnectAccount = (account, institution) => {
    setDisconnectAccountModal({ isOpen: true, account, institution });
  };

  const handleCancelDisconnectAccount = () => {
    setDisconnectAccountModal({ isOpen: false, account: null, institution: null });
  };

  const handleConfirmDisconnectAccount = async () => {
    const { account } = disconnectAccountModal;
    if (!account?.id) {
      alert("Unable to disconnect: Missing account information.");
      return;
    }
    try {
      setIsDisconnecting(true);
      const response = await fetch("/api/plaid/disconnect-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || "Failed to disconnect account",
        );
      }
      await response.json();
      refreshAccounts();
      setDisconnectAccountModal({ isOpen: false, account: null, institution: null });
    } catch (error) {
      console.error("Error disconnecting account:", error);
      alert(`Failed to disconnect ${account.name}: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <SettingsSection
        label="Connected Institutions"
        first
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
            <p className="text-sm text-[var(--color-muted)] mb-2">
              No institutions connected
            </p>
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
                <div className="mb-1 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    {institution.name}
                  </span>
                </div>
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
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "block";
                              }}
                            />
                          ) : null}
                          <PiBankFill
                            className={`h-4 w-4 text-[var(--color-muted)] ${
                              institution.logo ? "hidden" : "block"
                            }`}
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
                                  $
                                  {Math.abs(account.balance).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
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

      <ConfirmOverlay
        isOpen={disconnectAccountModal.isOpen}
        onCancel={handleCancelDisconnectAccount}
        onConfirm={handleConfirmDisconnectAccount}
        title={`Disconnect ${disconnectAccountModal.account?.name || "Account"}`}
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

      <AddAccountOverlay
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
      />

      <UpgradeOverlay
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
}
