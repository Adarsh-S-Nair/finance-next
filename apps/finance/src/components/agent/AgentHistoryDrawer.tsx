"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { ConfirmOverlay, Drawer } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
};

function formatRelative(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  const diffMin = Math.floor((now - ts) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type AgentHistoryDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Highlight the row for the conversation currently being viewed. */
  activeConversationId?: string | null;
  /** Called when the user picks a conversation from the list. */
  onSelect: (id: string) => void;
  /**
   * Optional "new chat" affordance shown at the top of the list.
   * Only meaningful when the caller has an active conversation (e.g.
   * AgentChat inside the overlay) — bottom-input callers should leave
   * this off, since they're already at "new chat" by default.
   */
  onNewChat?: () => void;
  /**
   * Called after a conversation is successfully deleted. AgentChat
   * uses this to bounce out of the deleted conversation if it was
   * the one being viewed.
   */
  onDeleted?: (id: string) => void;
};

/**
 * Shared conversation-history drawer. Used by:
 *   - AgentChat (inside the overlay) for switching between threads
 *   - BottomAgentInput (focused-state) for jumping into a thread
 *
 * Both open the same drawer from the same edge (left), with the
 * same row template and delete affordance, so users see the same
 * UI no matter where they invoke history. The drawer manages its
 * own list state and refetches on every open so a thread created
 * elsewhere in the session shows up without a parent prop dance.
 */
export default function AgentHistoryDrawer({
  isOpen,
  onClose,
  activeConversationId,
  onSelect,
  onNewChat,
  onDeleted,
}: AgentHistoryDrawerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowAtMount, setNowAtMount] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setNowAtMount(Date.now()), []);

  // Refetch on every open so the list reflects whatever's happened
  // since the user last viewed it (new threads, deletions in another
  // tab, etc).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await authFetch("/api/agent/conversations");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (!cancelled) setConversations(body.conversations ?? []);
      } catch {
        // Silent — drawer still works without the list.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/agent/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setPendingDeleteId(null);
      onDeleted?.(id);
    } catch {
      // Silent — user can retry.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Conversations"
        size="sm"
        side="left"
      >
        <div className="space-y-1">
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors"
            >
              <FiPlus className="h-4 w-4 text-[var(--color-muted)]" />
              New chat
            </button>
          )}

          {loading && conversations.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-6 text-center">
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-6 text-center">
              No past conversations.
            </div>
          ) : (
            <div className={onNewChat ? "pt-2" : ""}>
              {conversations.map((c) => {
                const active = activeConversationId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group relative flex items-center gap-1 rounded-md transition-colors ${
                      active
                        ? "bg-[var(--color-surface-alt)]"
                        : "hover:bg-[var(--color-surface-alt)]/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="flex-1 min-w-0 text-left px-2 py-2"
                    >
                      <div className="text-sm text-[var(--color-fg)] truncate">
                        {c.title?.trim() || "Untitled"}
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        {nowAtMount !== null
                          ? formatRelative(c.last_message_at, nowAtMount)
                          : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(c.id);
                      }}
                      aria-label="Delete conversation"
                      className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 mr-1 rounded-md text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-fg)]/[0.08] hover:text-[var(--color-danger)] transition-opacity"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Drawer>

      <ConfirmOverlay
        isOpen={pendingDeleteId !== null}
        onCancel={() => {
          if (!deleting) setPendingDeleteId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete conversation?"
        description="This permanently removes the conversation and all of its messages."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={deleting}
      />
    </>
  );
}
