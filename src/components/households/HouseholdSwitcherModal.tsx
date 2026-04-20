"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { authFetch } from "../../lib/api/fetch";
import { useHouseholds } from "../providers/HouseholdsProvider";
import { useToast } from "../providers/ToastProvider";

type Mode = "menu" | "create" | "join";

type JoinPreview = {
  household: { id: string; name: string; member_count: number };
  invited_by: { first_name: string | null; last_name: string | null } | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Mode;
}

export default function HouseholdSwitcherModal({ isOpen, onClose, initialMode = "menu" }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { refresh } = useHouseholds();
  const { setToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setName("");
      setCode("");
      setPreview(null);
      setPreviewError(null);
      setBusy(false);
    }
  }, [isOpen, initialMode]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setBusy(true);
      const response = await authFetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ title: "Couldn't create household", description: data?.error, variant: "error" });
        return;
      }
      await refresh();
      setToast({ title: "Household created", variant: "success" });
      onClose();
      router.push(`/households/${data.household.id}`);
    } finally {
      setBusy(false);
    }
  };

  const fetchPreview = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const response = await authFetch(`/api/households/join?code=${encodeURIComponent(normalized)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreview(null);
        setPreviewError(data?.error || "Invalid invite code");
        return;
      }
      setPreview(data as JoinPreview);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    try {
      setBusy(true);
      const response = await authFetch("/api/households/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ title: "Couldn't join", description: data?.error, variant: "error" });
        return;
      }
      await refresh();
      setToast({ title: "Joined household", variant: "success" });
      onClose();
      router.push(`/households/${data.household_id}`);
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "menu"
      ? "Households"
      : mode === "create"
      ? "Create a household"
      : "Join a household";

  const description =
    mode === "menu"
      ? "Share a combined view with family, partners, or roommates."
      : mode === "create"
      ? "Pick a name — you can change it later."
      : "Ask the owner for an 8-character invite code.";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description} size="sm">
      {mode === "menu" && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setMode("create")}
            className="flex flex-col items-start gap-1 rounded-md border border-[var(--color-border)] p-4 text-left transition-colors hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/5"
          >
            <span className="text-sm font-medium text-[var(--color-fg)]">Create household</span>
            <span className="text-xs text-[var(--color-muted)]">
              Start a new household and invite others.
            </span>
          </button>
          <button
            onClick={() => setMode("join")}
            className="flex flex-col items-start gap-1 rounded-md border border-[var(--color-border)] p-4 text-left transition-colors hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/5"
          >
            <span className="text-sm font-medium text-[var(--color-fg)]">Join with a code</span>
            <span className="text-xs text-[var(--color-muted)]">
              Use an invite code from someone who&apos;s already a member.
            </span>
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
              Household name
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleCreate();
              }}
              placeholder="e.g. Family, Apartment 4B"
              maxLength={60}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("menu")} disabled={busy}>
              Back
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || busy} loading={busy}>
              Create
            </Button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
              Invite code
            </label>
            <Input
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPreview(null);
                setPreviewError(null);
              }}
              onBlur={fetchPreview}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchPreview();
              }}
              placeholder="ABCD1234"
              maxLength={12}
              className="uppercase tracking-[0.2em]"
            />
            {previewLoading && (
              <p className="mt-2 text-xs text-[var(--color-muted)]">Looking up invite…</p>
            )}
            {previewError && (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{previewError}</p>
            )}
            {preview && (
              <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-3">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {preview.household.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {preview.household.member_count} member
                  {preview.household.member_count === 1 ? "" : "s"}
                  {preview.invited_by?.first_name
                    ? ` · Invited by ${preview.invited_by.first_name}`
                    : ""}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("menu")} disabled={busy}>
              Back
            </Button>
            <Button onClick={handleJoin} disabled={!code.trim() || busy} loading={busy}>
              {preview ? `Join ${preview.household.name}` : "Join"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
