"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

const KEY_ANTHROPIC = "agent.anthropic_api_key";
const KEY_MODEL = "agent.model";

const MODELS = [
  { value: "claude-opus-4-7", label: "Claude Opus 4.7", note: "Highest quality, slowest, most expensive" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Balanced — good default" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "Fastest, cheapest" },
];

type ConfigRow = {
  key: string;
  value: string | null;
  display: string;
  is_secret: boolean;
  updated_at: string;
};

export function AgentConfigClient() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API key form
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);

  // Model form
  const [savingModel, setSavingModel] = useState(false);

  // Saved indicator
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
      setRows(body.rows ?? []);
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
  const currentModel = modelRow?.value ?? "claude-sonnet-4-6";

  async function saveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setError(null);
    setSavingKey(true);
    try {
      const res = await fetch("/api/platform-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: KEY_ANTHROPIC, value: trimmed, is_secret: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      setKeyInput("");
      flashSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingKey(false);
    }
  }

  async function clearKey() {
    if (!confirm("Clear the Anthropic API key? The agent will fall back to ANTHROPIC_API_KEY env var (if set) or stop working.")) return;
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

  async function saveModel(modelId: string) {
    setError(null);
    setSavingModel(true);
    try {
      const res = await fetch("/api/platform-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: KEY_MODEL, value: modelId, is_secret: false }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      flashSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingModel(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="px-3 py-2 rounded-md bg-[var(--color-danger,#dc2626)]/10 border border-[var(--color-danger,#dc2626)]/20 text-sm text-[var(--color-danger,#dc2626)]">
          {error}
        </div>
      )}

      {/* API key */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
          Anthropic API key
        </h2>
        <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5 space-y-4">
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Powers the personal finance agent at <code className="px-1 py-0.5 rounded bg-[var(--color-fg)]/[0.06] font-mono text-[11px]">/agent</code> on the finance app for every user. Stored encrypted at rest. The chat route falls back to the <code className="px-1 py-0.5 rounded bg-[var(--color-fg)]/[0.06] font-mono text-[11px]">ANTHROPIC_API_KEY</code> env var if no DB value is set.
          </p>

          {loading ? (
            <div className="text-sm text-[var(--color-muted)]">Loading…</div>
          ) : apiKeyRow ? (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--color-fg)]">Current key</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5 font-mono">
                  {apiKeyRow.display}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                  Updated {new Date(apiKeyRow.updated_at).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={clearKey}
                disabled={clearingKey}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--color-fg)]/15 hover:border-[var(--color-fg)]/30 disabled:opacity-50"
              >
                {clearingKey ? "Clearing…" : "Clear"}
              </button>
            </div>
          ) : (
            <div className="text-xs text-[var(--color-muted)]">
              No DB key set — the agent uses <code className="px-1 py-0.5 rounded bg-[var(--color-fg)]/[0.06] font-mono text-[11px]">ANTHROPIC_API_KEY</code> from the env.
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              disabled={savingKey}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md bg-[var(--color-bg)] border border-[var(--color-fg)]/10 text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={saveKey}
              disabled={savingKey || !keyInput.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
            >
              {savingKey ? "Saving…" : apiKeyRow ? "Replace key" : "Save key"}
            </button>
          </div>
        </div>
      </section>

      {/* Model */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
          Model
        </h2>
        <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5">
          <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
            Which Claude model the agent uses. Falls back to{" "}
            <code className="px-1 py-0.5 rounded bg-[var(--color-fg)]/[0.06] font-mono text-[11px]">
              claude-sonnet-4-6
            </code>{" "}
            if not set.
          </p>
          <div className="space-y-2">
            {MODELS.map((m) => {
              const active = currentModel === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={savingModel || active}
                  onClick={() => saveModel(m.value)}
                  className={clsx(
                    "w-full text-left flex items-center justify-between gap-4 px-3 py-3 rounded-md border transition-colors",
                    active
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)]/[0.04]"
                      : "border-[var(--color-fg)]/10 hover:border-[var(--color-fg)]/30 disabled:opacity-50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-fg)]">
                      {m.label}
                    </div>
                    <div className="text-xs text-[var(--color-muted)] mt-0.5">{m.note}</div>
                    <div className="text-[11px] text-[var(--color-muted)] mt-0.5 font-mono">
                      {m.value}
                    </div>
                  </div>
                  {active && (
                    <span className="text-xs font-medium text-[var(--color-fg)] flex-shrink-0">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {savedRecently && (
        <div className="text-xs text-[var(--color-muted)]">Saved.</div>
      )}
    </div>
  );
}
