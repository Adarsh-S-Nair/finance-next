"use client";

import { useEffect, useState } from "react";

const KEY_ANTHROPIC = "agent.anthropic_api_key";
const KEY_MODEL = "agent.model";

const MODELS = [
  {
    value: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    note: "Fastest, cheapest",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    note: "Balanced — good default",
  },
  {
    value: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    note: "Highest quality, most expensive",
  },
];

const DEFAULT_MODEL = MODELS[0].value;

type ConfigRow = {
  key: string;
  value: string | null;
  display: string;
  is_secret: boolean;
  updated_at: string;
};

function formatTimestamp(iso: string): string {
  // Pure transformation — no Date.now() so the purity rule stays happy.
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgentConfigClient() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Uncommitted form state
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Async state
  const [saving, setSaving] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  function flashSaved() {
    setSavedRecently(true);
    setTimeout(() => setSavedRecently(false), 2500);
  }

  async function load() {
    try {
      const res = await fetch("/api/platform-config", { cache: "no-store" });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const body = await res.json();
      const fetched = (body.rows ?? []) as ConfigRow[];
      setRows(fetched);
      const modelRow = fetched.find((r) => r.key === KEY_MODEL);
      setSelectedModel(modelRow?.value ?? DEFAULT_MODEL);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const apiKeyRow = rows.find((r) => r.key === KEY_ANTHROPIC);
  const modelRow = rows.find((r) => r.key === KEY_MODEL);
  const persistedModel = modelRow?.value ?? DEFAULT_MODEL;
  const persistedModelLabel =
    MODELS.find((m) => m.value === persistedModel)?.label ?? persistedModel;

  const apiKeyDirty = apiKeyInput.trim().length > 0;
  const modelDirty = selectedModel !== persistedModel;
  const dirty = apiKeyDirty || modelDirty;

  async function save() {
    if (!dirty || saving) return;
    setError(null);
    setSaving(true);
    try {
      // Save changed fields in sequence. The API takes one key/value pair
      // per call; that's fine — at most two calls per save.
      if (apiKeyDirty) {
        const r = await fetch("/api/platform-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: KEY_ANTHROPIC,
            value: apiKeyInput.trim(),
            is_secret: true,
          }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || `Failed to save key (${r.status})`);
      }
      if (modelDirty) {
        const r = await fetch("/api/platform-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: KEY_MODEL,
            value: selectedModel,
            is_secret: false,
          }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || `Failed to save model (${r.status})`);
      }
      setApiKeyInput("");
      flashSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    if (
      !confirm(
        "Clear the Anthropic API key? The agent will fall back to the ANTHROPIC_API_KEY env var (if set) or stop working.",
      )
    ) {
      return;
    }
    setError(null);
    setClearingKey(true);
    try {
      const res = await fetch(
        `/api/platform-config?key=${encodeURIComponent(KEY_ANTHROPIC)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Clear failed (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setClearingKey(false);
    }
  }

  const selectedModelDescription = MODELS.find((m) => m.value === selectedModel)?.note;

  return (
    <div className="space-y-8">
      {error && (
        <div className="px-3 py-2 rounded-md bg-[var(--color-danger,#dc2626)]/10 border border-[var(--color-danger,#dc2626)]/20 text-sm text-[var(--color-danger,#dc2626)]">
          {error}
        </div>
      )}

      {/* API key section */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
          Anthropic API key
        </h2>
        <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5 space-y-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--color-fg)]">
                Platform key
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                Powers the personal finance agent for every user. Encrypted at rest.
                Falls back to the{" "}
                <code className="px-1 py-0.5 rounded bg-[var(--color-fg)]/[0.06] font-mono text-[11px]">
                  ANTHROPIC_API_KEY
                </code>{" "}
                env var when no DB value is set.
              </p>
              {loading ? null : apiKeyRow ? (
                <p className="mt-2 text-xs text-[var(--color-muted)] font-mono">
                  Current: {apiKeyRow.display} · updated {formatTimestamp(apiKeyRow.updated_at)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  No DB key — using env var fallback.
                </p>
              )}
            </div>
            {apiKeyRow && (
              <button
                type="button"
                onClick={clearKey}
                disabled={clearingKey || saving}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--color-fg)]/15 hover:border-[var(--color-fg)]/30 disabled:opacity-50 flex-shrink-0"
              >
                {clearingKey ? "Clearing…" : "Clear"}
              </button>
            )}
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={apiKeyRow ? "Paste new key to replace (sk-ant-…)" : "sk-ant-…"}
            autoComplete="off"
            spellCheck={false}
            disabled={loading || saving}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg)] border border-[var(--color-fg)]/10 text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 disabled:opacity-60"
          />
        </div>
      </section>

      {/* Model section */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
          Model
        </h2>
        <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-fg)]">
                Claude model
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                Active: <span className="text-[var(--color-fg)]">{persistedModelLabel}</span>
                {selectedModelDescription && selectedModel === persistedModel && (
                  <> · {selectedModelDescription}</>
                )}
                {modelDirty && (
                  <>
                    {" "}—{" "}
                    <span className="text-[var(--color-fg)]">
                      pending: {MODELS.find((m) => m.value === selectedModel)?.label}
                    </span>
                  </>
                )}
              </p>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loading || saving}
              className="px-3 py-2 text-sm rounded-md bg-[var(--color-bg)] border border-[var(--color-fg)]/10 text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 disabled:opacity-60 cursor-pointer flex-shrink-0"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {savedRecently && (
          <span className="text-xs text-[var(--color-muted)]">Saved</span>
        )}
        {dirty && !savedRecently && !saving && (
          <span className="text-xs text-[var(--color-muted)]">Unsaved changes</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
