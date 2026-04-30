"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@zervo/ui";
import PageContainer from "../../../../components/layout/PageContainer";
import { authFetch } from "../../../../lib/api/fetch";
import { FiChevronLeft } from "react-icons/fi";

type Profile = {
  ai_provider: "anthropic";
  ai_model: string;
  custom_instructions: string | null;
  updated_at: string | null;
};

export default function AgentSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [instructions, setInstructions] = useState("");

  // Async state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRecently, setSavedRecently] = useState(false);

  function flashSaved() {
    setSavedRecently(true);
    setTimeout(() => setSavedRecently(false), 2500);
  }

  async function load() {
    try {
      const res = await authFetch("/api/agent/profile");
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const body = (await res.json()) as Profile;
      setProfile(body);
      setInstructions(body.custom_instructions ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveInstructions() {
    setError(null);
    setSaving(true);
    try {
      const res = await authFetch("/api/agent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_instructions: instructions }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      flashSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto py-6 px-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors mb-4"
        >
          <FiChevronLeft className="h-3.5 w-3.5" />
          Back to Settings
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--color-fg)]">Agent</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Tune how your personal finance agent behaves across conversations.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Custom instructions */}
        <section className="py-5 border-b border-[var(--color-border)]">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Custom instructions
          </h2>
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Anything you want the agent to remember about you across conversations — your
            goals, what to bug you about, what to ignore.
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g., I'm saving for a house by 2027. Don't comment on coffee purchases."
            rows={4}
            disabled={loading}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 resize-y disabled:opacity-60"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-[var(--color-muted)]">
              {savedRecently ? "Saved" : ""}
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={saveInstructions}
              disabled={(instructions ?? "") === (profile?.custom_instructions ?? "")}
              loading={saving}
            >
              {saving ? "Saving" : "Save instructions"}
            </Button>
          </div>
        </section>

        {/* Model info */}
        <section className="py-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Model
          </h2>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Powered by Anthropic{" "}
            <code className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] text-[var(--color-fg)] font-mono text-[11px]">
              {profile?.ai_model ?? "claude-sonnet-4-6"}
            </code>
            . Model selection will be configurable in a future update.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
