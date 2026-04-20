"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LuCopy, LuPlus, LuSettings } from "react-icons/lu";
import PageContainer from "../../../../components/layout/PageContainer";
import Card from "../../../../components/ui/Card";
import Button from "../../../../components/ui/Button";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import NetWorthBanner from "../../../../components/dashboard/NetWorthBanner";
import { authFetch } from "../../../../lib/api/fetch";
import { useUser } from "../../../../components/providers/UserProvider";
import { useHouseholds } from "../../../../components/providers/HouseholdsProvider";
import { useToast } from "../../../../components/providers/ToastProvider";

function formatName(member) {
  const parts = [member.first_name, member.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return member.email || "Member";
}

function initialsFor(member) {
  const parts = [member.first_name, member.last_name].filter(Boolean);
  if (parts.length > 0) return parts.map((p) => p[0]).join("").toUpperCase();
  return (member.email?.[0] ?? "?").toUpperCase();
}

const PLACEHOLDER_NET_WORTH = {
  netWorth: 0,
  percentChange: null,
  breakdown: {
    totalAssets: 0,
    totalLiabilities: 0,
    assetSegments: [],
    liabilitySegments: [],
  },
};

export default function HouseholdPage() {
  const params = useParams();
  const router = useRouter();
  const householdId = params?.id;
  const { user } = useUser();
  const { refresh: refreshHouseholds } = useHouseholds();
  const { setToast } = useToast();

  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const isOwner = household?.role === "owner";
  const activeInvite = invitations[0] ?? null;

  const load = useCallback(async () => {
    if (!householdId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch(`/api/households/${householdId}`);
      if (response.status === 404) {
        setError("Household not found.");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError(`Failed to load household (${response.status}).`);
        setLoading(false);
        return;
      }
      const data = await response.json();
      setHousehold(data.household);
      setMembers(data.members ?? []);
    } catch (err) {
      console.error("[households] load error", err);
      setError(err?.message || "Failed to load household.");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  const loadInvitations = useCallback(async () => {
    if (!householdId) return;
    try {
      const response = await authFetch(`/api/households/${householdId}/invitations`);
      if (!response.ok) return;
      const data = await response.json();
      setInvitations(data.invitations ?? []);
    } catch (err) {
      console.error("[households] load invitations error", err);
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (household && isOwner) loadInvitations();
  }, [household, isOwner, loadInvitations]);

  const handleCreateInvite = async () => {
    try {
      setCreatingInvite(true);
      const response = await authFetch(`/api/households/${householdId}/invitations`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ title: "Couldn't create invite", description: data?.error, variant: "error" });
        return;
      }
      setInvitations((prev) => [data.invitation, ...prev]);
      setToast({ title: "Invite created", variant: "success" });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast({ title: "Copied invite code", variant: "success" });
    } catch {
      setToast({ title: "Couldn't copy", variant: "error" });
    }
  };

  const handleLeave = async () => {
    try {
      const response = await authFetch(`/api/households/${householdId}/members/me`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          title: "Couldn't leave",
          description: data?.message || data?.error,
          variant: "error",
        });
        setLeaveOpen(false);
        return;
      }
      await refreshHouseholds();
      setToast({
        title: data?.deleted ? "Household deleted" : "Left household",
        variant: "success",
      });
      setLeaveOpen(false);
      router.push("/dashboard");
    } catch (err) {
      console.error("[households] leave error", err);
      setToast({ title: "Couldn't leave", variant: "error" });
      setLeaveOpen(false);
    }
  };

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;
      return 0;
    });
  }, [members, user?.id]);

  if (loading) {
    return (
      <PageContainer title="Household">
        <p className="text-sm text-[var(--color-muted)]">Loading household…</p>
      </PageContainer>
    );
  }

  if (error || !household) {
    return (
      <PageContainer title="Household">
        <p className="text-sm text-[var(--color-muted)]">{error || "Household not found."}</p>
        <div className="mt-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </PageContainer>
    );
  }

  const memberCountLabel = `${members.length} member${members.length === 1 ? "" : "s"}`;

  return (
    <PageContainer
      title={
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="block h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: household.color }}
            aria-hidden
          />
          <span className="truncate">{household.name}</span>
          <span className="text-xs font-normal text-[var(--color-muted)] hidden sm:inline">
            {memberCountLabel}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Net worth banner with placeholder data — wires up to real
            aggregated household data in a follow-up milestone. */}
        <div className="relative">
          <NetWorthBanner mockData={PLACEHOLDER_NET_WORTH} />
          <div className="mt-3 text-xs text-[var(--color-muted)]">
            Shared accounts aren&apos;t hooked up yet. Once members opt accounts into this
            household, you&apos;ll see a combined net worth here.
          </div>
        </div>

        {/* Members */}
        <Card title="Members">
          <ul className="divide-y divide-[var(--color-border)]/60">
            {orderedMembers.map((member) => {
              const name = formatName(member);
              const isYou = member.user_id === user?.id;
              return (
                <li key={member.user_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-on-accent,white)]">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{initialsFor(member)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-fg)] truncate">
                      {name}
                      {isYou && (
                        <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">(you)</span>
                      )}
                    </p>
                    {member.email && (
                      <p className="text-xs text-[var(--color-muted)] truncate">{member.email}</p>
                    )}
                  </div>
                  <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    {member.role}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Invitations — owners only */}
        {isOwner && (
          <Card title="Invite members">
            {activeInvite ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 px-4 py-3">
                  <div>
                    <p className="font-mono text-base tracking-[0.2em] text-[var(--color-fg)]">
                      {activeInvite.code}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      Expires {new Date(activeInvite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(activeInvite.code)}>
                    <LuCopy className="h-4 w-4" />
                    <span className="ml-1">Copy</span>
                  </Button>
                </div>
                <div className="flex items-center justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCreateInvite} loading={creatingInvite}>
                    <LuPlus className="h-4 w-4" />
                    <span className="ml-1">New code</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-[var(--color-muted)]">
                  Generate an 8-character code that anyone can redeem to join this household.
                </p>
                <Button onClick={handleCreateInvite} loading={creatingInvite}>
                  <LuPlus className="h-4 w-4" />
                  <span className="ml-1">Create invite code</span>
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Danger zone — leave / auto-delete when last member */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-fg)] flex items-center gap-2">
                <LuSettings className="h-4 w-4 text-[var(--color-muted)]" />
                Leave household
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {members.length <= 1
                  ? "You're the only member, so leaving will delete the household."
                  : "You'll lose access to this household's combined view."}
              </p>
            </div>
            <Button variant="dangerSubtle" onClick={() => setLeaveOpen(true)}>
              {members.length <= 1 ? "Delete" : "Leave"}
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        title={members.length <= 1 ? `Delete ${household.name}?` : `Leave ${household.name}?`}
        description={
          members.length <= 1
            ? "This will permanently delete the household. This can't be undone."
            : "You'll stop seeing this household in your sidebar. You can rejoin with a new invite code."
        }
        confirmLabel={members.length <= 1 ? "Delete" : "Leave"}
        variant="danger"
      />
    </PageContainer>
  );
}
