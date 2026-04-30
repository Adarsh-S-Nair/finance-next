"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@zervo/ui";
import PageContainer from "../../../../components/layout/PageContainer";
import { authFetch } from "../../../../lib/api/fetch";
import { FiChevronLeft, FiCheckCircle, FiExternalLink } from "react-icons/fi";

type Profile = {
  ai_provider: "anthropic";
  ai_model: string;
  has_api_key: boolean;
  custom_instructions: string | null;
  updated_at: string | null;
};

export default function AgentSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [instructions, setInstructions] = useState("");

  // Async state
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
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

  async function saveApiKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const res = await authFetch("/api/agent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      setApiKeyInput("");
      flashSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function clearApiKey() {
    if (!confirm("Clear your saved API key? You'll need to paste it again to chat.")) return;
    setError(null);
    setClearing(true);
    try {
      const res = await authFetch("/api/agent/profile", { method: "DELETE" });
      if (!res.ok) throw new Error(`Clear failed (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  }

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
            Configure your personal finance agent. Bring your own Anthropic API key — the
            agent runs on your usage, not ours.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* API key section */}
        <section className="py-5 border-b border-[var(--color-border)]">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Anthropic API Key
          </h2>

          {loading ? (
            <div className="text-sm text-[var(--color-muted)]">Loading…</div>
          ) : profile?.has_api_key ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
                <FiCheckCircle className="h-4 w-4 text-[var(--color-success,#16a34a)]" />
                <span>Key saved — agent is ready to chat.</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clearApiKey}
                loading={clearing}
              >
                {clearing ? "Clearing" : "Clear key"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-muted)]">
                Get a key from the{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5 hover:text-[var(--color-fg)]"
                >
                  Anthropic console
                  <FiExternalLink className="h-3 w-3" />
                </a>
                . Keys start with <code className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] text-[var(--color-fg)] font-mono text-[11px]">sk-ant-</code>. Stored encrypted on our server, never sent to the browser after save.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={saveApiKey}
                  disabled={!apiKeyInput.trim()}
                  loading={saving}
                >
                  {saving ? "Saving" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Custom instructions section */}
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
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-y"
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

        {/* Cost transparency */}
        <section className="py-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Cost
          </h2>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Each chat turn costs roughly $0.01–0.02 of Anthropic credits at current pricing.
            Anthropic bills your account directly — we never see or charge for AI usage.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
