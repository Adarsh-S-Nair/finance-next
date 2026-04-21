"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiX, FiPlus, FiCopy } from "react-icons/fi";
import PageContainer from "../../../../../components/layout/PageContainer";
import { authFetch } from "../../../../../lib/api/fetch";
import { useUser } from "../../../../../components/providers/UserProvider";
import { useHouseholdMeta } from "../../../../../components/providers/HouseholdDataProvider";
import { useHouseholds } from "../../../../../components/providers/HouseholdsProvider";
import { useToast } from "../../../../../components/providers/ToastProvider";
import HouseholdInviteModal from "../../../../../components/households/HouseholdInviteModal";
import { ConfirmOverlay } from "@zervo/ui";

function SectionLabel({ children, action }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {children}
      </span>
      {action}
    </div>
  );
}

function SkeletonMemberRow() {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 animate-pulse">
      <div className="h-9 w-9 rounded-full bg-[var(--color-fg)]/[0.08] flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-[var(--color-fg)]/[0.08]" />
        <div className="h-3 w-40 rounded bg-[var(--color-fg)]/[0.05]" />
      </div>
      <div className="h-3 w-12 rounded bg-[var(--color-fg)]/[0.05]" />
    </li>
  );
}

function SkeletonDangerZone() {
  return (
    <div className="py-3 flex items-center justify-between gap-3 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-3.5 w-28 rounded bg-[var(--color-fg)]/[0.08]" />
        <div className="h-3 w-48 rounded bg-[var(--color-fg)]/[0.05]" />
      </div>
      <div className="h-7 w-16 rounded-full bg-[var(--color-fg)]/[0.05]" />
    </div>
  );
}

function formatMemberName(member) {
  const parts = [member?.first_name, member?.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return member?.email || "Member";
}

function formatInviteeName(invite) {
  const user = invite?.invited_user;
  if (!user) return invite?.code ? `Code · ${invite.code}` : "Someone";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return user.email || "Someone";
}

function initialsFor(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return "?";
}

export default function HouseholdSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const householdId = typeof params?.id === "string" ? params.id : null;
  const { user } = useUser();
  const { household, members } = useHouseholdMeta();
  const { refresh: refreshHouseholds } = useHouseholds();
  const { setToast } = useToast();

  const [invitations, setInvitations] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const isOwner = useMemo(() => {
    if (!user?.id) return false;
    const me = members.find((m) => m.user_id === user.id);
    return me?.role === "owner";
  }, [members, user?.id]);

  const loadInvitations = useCallback(async () => {
    if (!householdId) return;
    try {
      setLoadingInvites(true);
      const res = await authFetch(`/api/households/${householdId}/invitations`);
      if (!res.ok) return;
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } finally {
      setLoadingInvites(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (isOwner) loadInvitations();
    else setLoadingInvites(false);
  }, [isOwner, loadInvitations]);

  const revokeInvite = async (invite) => {
    try {
      setRevokingId(invite.id);
      const res = await authFetch(
        `/api/households/${householdId}/invitations/${invite.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ title: "Couldn't revoke", description: data?.error, variant: "error" });
        return;
      }
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } finally {
      setRevokingId(null);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast({ title: "Copied invite code", variant: "success" });
    } catch {
      setToast({ title: "Couldn't copy", variant: "error" });
    }
  };

  const handleLeave = async () => {
    if (!householdId) return;
    try {
      const res = await authFetch(`/api/households/${householdId}/members/me`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          title: "Couldn't leave",
          description: data?.message || data?.error,
          variant: "error",
        });
        return;
      }
      await refreshHouseholds();
      setToast({
        title: data?.deleted ? "Household deleted" : "Left household",
        variant: "success",
      });
      router.push("/dashboard");
    } finally {
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

  const titleNode = "Settings";

  // Household meta (members) is fetched by HouseholdDataProvider. While we
  // wait for the first response `household` is null — use it as the loading
  // gate so the sections render skeleton rows instead of popping in.
  const metaLoading = !household;

  return (
    <PageContainer title={titleNode}>
      <div className="space-y-10">
        {/* Members */}
        <section>
          <SectionLabel>Members</SectionLabel>
          <ul className="divide-y divide-[var(--color-fg)]/[0.06]">
            {metaLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonMemberRow key={i} />)
              : orderedMembers.map((member) => {
                  const name = formatMemberName(member);
                  const isYou = member.user_id === user?.id;
                  return (
                    <li key={member.user_id} className="flex items-center gap-3 py-3 first:pt-0">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-on-accent,white)]">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatar_url} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{initialsFor(name)}</span>
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
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        {member.role}
                      </span>
                    </li>
                  );
                })}
          </ul>
        </section>

        {/* Pending invitations (owner only) */}
        {isOwner && (
          <section>
            <SectionLabel
              action={
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                >
                  <FiPlus className="h-3.5 w-3.5" />
                  New invite
                </button>
              }
            >
              Pending invites
            </SectionLabel>
            {loadingInvites ? (
              <ul className="divide-y divide-[var(--color-fg)]/[0.06]">
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonMemberRow key={i} />
                ))}
              </ul>
            ) : invitations.length === 0 ? (
              <p className="py-3 text-sm text-[var(--color-muted)]">
                No outgoing invites right now.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-fg)]/[0.06]">
                {invitations.map((invite) => {
                  const name = formatInviteeName(invite);
                  const invitedUser = invite.invited_user;
                  const isCode = !invite.invited_user_id;
                  return (
                    <li key={invite.id} className="flex items-center gap-3 py-3 first:pt-0">
                      {isCode ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-xs text-[var(--color-muted)]">
                          <span className="font-mono text-[10px]">#</span>
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-on-accent,white)]">
                          {invitedUser?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={invitedUser.avatar_url} alt={name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{initialsFor(name)}</span>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-fg)] truncate">
                          {name}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {isCode
                            ? `Anyone can redeem · expires ${new Date(invite.expires_at).toLocaleDateString()}`
                            : `Pending · expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      {isCode && invite.code && (
                        <button
                          type="button"
                          onClick={() => copyCode(invite.code)}
                          aria-label="Copy code"
                          className="p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05] transition-colors cursor-pointer"
                        >
                          <FiCopy className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => revokeInvite(invite)}
                        disabled={revokingId === invite.id}
                        aria-label="Revoke invite"
                        className="p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Danger / leave zone */}
        <section>
          <SectionLabel>Danger zone</SectionLabel>
          {metaLoading ? (
            <SkeletonDangerZone />
          ) : (
            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {members.length <= 1 ? "Delete household" : "Leave household"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {members.length <= 1
                    ? "You're the only member. Leaving will permanently delete this household."
                    : "You'll stop seeing this household in your sidebar. You can rejoin with a new invite."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)] transition-colors cursor-pointer"
              >
                {members.length <= 1 ? "Delete" : "Leave"}
              </button>
            </div>
          )}
        </section>
      </div>

      <HouseholdInviteModal
        isOpen={inviteOpen}
        householdId={householdId}
        onClose={() => {
          setInviteOpen(false);
          loadInvitations();
        }}
      />

      <ConfirmOverlay
        isOpen={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        title={members.length <= 1 ? `Delete ${household?.name ?? "this household"}?` : `Leave ${household?.name ?? "this household"}?`}
        description={
          members.length <= 1
            ? "This will permanently delete the household. This can't be undone."
            : "You'll stop seeing this household in your sidebar. You can rejoin with a new invite."
        }
        confirmLabel={members.length <= 1 ? "Delete" : "Leave"}
        variant="danger"
      />
    </PageContainer>
  );
}
