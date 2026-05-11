"use client";

import { useEffect, useState } from "react";
import { Button } from "@zervo/ui";
import { authFetch } from "../../../../lib/api/fetch";
import { FiX, FiBookmark } from "react-icons/fi";

type Profile = {
  ai_provider: "anthropic";
  ai_model: string;
  custom_instructions: string | null;
  updated_at: string | null;
};

type Memory = {
  id: string;
  content: string;
  source: "agent" | "user";
  created_at: string;
};

export default function AgentSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Memories state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState("");
  const [addingMemory, setAddingMemory] = useState(false);

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

  async function loadMemories() {
    try {
      const res = await authFetch("/api/agent/memories");
      if (!res.ok) throw new Error(`Memory load failed (${res.status})`);
      const body = (await res.json()) as { memories: Memory[] };
      setMemories(body.memories ?? []);
    } catch (e) {
      // Non-fatal; just leave the list empty.
      console.error("Failed to load memories", e);
    } finally {
      setMemoriesLoading(false);
    }
  }

  async function forgetMemory(id: string) {
    setForgettingId(id);
    try {
      const res = await authFetch(`/api/agent/memories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Forget failed (${res.status})`);
      // Optimistic — drop from local list. Server already soft-deleted.
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to forget memory");
    } finally {
      setForgettingId(null);
    }
  }

  async function addMemory() {
    const content = newMemory.trim();
    if (content.length === 0) return;
    setAddingMemory(true);
    try {
      const res = await authFetch("/api/agent/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Add failed (${res.status})`);
      // Prepend the new memory to the list. Source = 'user' since
      // it came from this UI.
      const memory = body.memory as Memory | undefined;
      if (memory) setMemories((prev) => [memory, ...prev]);
      setNewMemory("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add memory");
    } finally {
      setAddingMemory(false);
    }
  }

  useEffect(() => {
    load();
    loadMemories();
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
    <>
      <div className="mb-6">
        <h1 className="text-base font-medium text-[var(--color-fg)]">Agent</h1>
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

        {/* Memories */}
        <section className="py-5 border-b border-[var(--color-border)]">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Memories
          </h2>
          <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
            Things the agent remembers about you across conversations. The agent
            saves these automatically when you share something durable in chat
            (commitments, preferences, household details). You can also add
            them manually below. Anything in this list gets prepended to the
            agent&apos;s context every chat.
          </p>

          {/* List of memories */}
          {memoriesLoading ? (
            <div className="text-xs text-[var(--color-muted)]">Loading memories...</div>
          ) : memories.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] italic">
              No memories yet. The agent will save things here as you chat, or
              you can add one below.
            </div>
          ) : (
            <ul className="space-y-2 mb-4">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-start gap-3 py-2"
                >
                  <FiBookmark
                    className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                      m.source === "user"
                        ? "text-[var(--color-fg)]"
                        : "text-[var(--color-muted)]"
                    }`}
                    strokeWidth={2}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-fg)] leading-relaxed">
                      {m.content}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                      {m.source === "user" ? "Added by you" : "Saved by agent"}
                      {" - "}
                      {new Date(m.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => forgetMemory(m.id)}
                    disabled={forgettingId === m.id}
                    aria-label="Forget this memory"
                    className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-muted)] hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all"
                  >
                    <FiX className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add a memory manually */}
          <div className="pt-3 border-t border-[var(--color-border)]/30">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] mb-2">
              Add your own
            </div>
            <textarea
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="e.g., I have a $4,800/mo mortgage paid from an old account that isn't connected here."
              rows={2}
              maxLength={1000}
              disabled={addingMemory}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 resize-y disabled:opacity-60"
            />
            <div className="mt-2 flex items-center justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={addMemory}
                disabled={newMemory.trim().length === 0}
                loading={addingMemory}
              >
                Save memory
              </Button>
            </div>
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
    </>
  );
}
