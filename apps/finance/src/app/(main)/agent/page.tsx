"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiPlus, FiClock, FiTrash2 } from "react-icons/fi";
import { marked } from "marked";
import { Drawer, ConfirmOverlay } from "@zervo/ui";
import { authFetch } from "../../../lib/api/fetch";
import { useUser } from "../../../components/providers/UserProvider";
import ToolWidget, {
  type ToolBlock as ToolBlockData,
} from "../../../components/agent/widgets/ToolWidget";
import { AnimateProvider } from "../../../components/agent/widgets/primitives";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type TextBlock = { kind: "text"; text: string };
type ToolBlock = {
  kind: "tool";
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  isError?: boolean;
};
type Block = TextBlock | ToolBlock;

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; blocks: Block[] };

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
};

// Persisted content shapes — we accept both legacy {text: string} and
// new {blocks: ...} on assistant rows.
type StoredContent = {
  text?: unknown;
  blocks?: unknown;
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "How was my spending this month?",
  "Am I on track for my savings goals?",
  "What's my biggest recurring expense?",
  "Show me my budgets.",
];

function greeting(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRelative(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  const diffMin = Math.floor((now - ts) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Convert a server row into the kind of content the UI cares about.
type DbRow = {
  id: string;
  role: string;
  content: StoredContent;
};

function rowsToMessages(rows: DbRow[]): Message[] {
  const messages: Message[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      const text = typeof row.content?.text === "string" ? row.content.text : "";
      if (text) {
        messages.push({ id: row.id, role: "user", text });
      }
    } else if (row.role === "assistant") {
      const blocks: Block[] = [];
      // Legacy text-only assistant rows.
      if (typeof row.content?.text === "string") {
        if (row.content.text) blocks.push({ kind: "text", text: row.content.text });
      } else if (Array.isArray(row.content?.blocks)) {
        for (const b of row.content.blocks as Array<{
          type?: string;
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
        }>) {
          if (b.type === "text" && typeof b.text === "string") {
            blocks.push({ kind: "text", text: b.text });
          } else if (b.type === "tool_use" && b.id && b.name) {
            blocks.push({
              kind: "tool",
              id: b.id,
              name: b.name,
              input: b.input,
            });
          }
        }
      }
      messages.push({ id: row.id, role: "assistant", blocks });
    } else if (row.role === "tool") {
      // Attach tool_result blocks to the most recent assistant message's
      // matching tool_use blocks.
      const stored = row.content;
      if (!Array.isArray(stored?.blocks)) continue;
      // Find the most recent assistant message in messages so far.
      let target: Message | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          target = messages[i];
          break;
        }
      }
      if (!target || target.role !== "assistant") continue;

      for (const tr of stored.blocks as Array<{
        type?: string;
        tool_use_id?: string;
        content?: unknown;
        is_error?: boolean;
      }>) {
        if (tr.type !== "tool_result" || !tr.tool_use_id) continue;
        const block = target.blocks.find(
          (b): b is ToolBlock => b.kind === "tool" && b.id === tr.tool_use_id,
        );
        if (!block) continue;
        let parsed: unknown = tr.content;
        if (typeof tr.content === "string") {
          try {
            parsed = JSON.parse(tr.content);
          } catch {
            parsed = tr.content;
          }
        }
        block.output = parsed;
        if (tr.is_error) block.isError = true;
      }
    }
  }
  return messages;
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const userCtx = useUser() as { profile?: { first_name?: string | null } | null };
  const firstName = userCtx?.profile?.first_name ?? null;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);

  // Topbar portal for the conversation-history button.
  const [topbarPortal, setTopbarPortal] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopbarPortal(document.getElementById("topbar-tools-portal"));
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [latestRes, listRes] = await Promise.all([
          authFetch("/api/agent/conversation"),
          authFetch("/api/agent/conversations"),
        ]);
        if (!latestRes.ok) throw new Error(`Conversation load failed (${latestRes.status})`);
        const latest = await latestRes.json();
        if (cancelled) return;
        setConversation(latest.conversation ?? null);
        setMessages(rowsToMessages(latest.messages ?? []));
        if (listRes.ok) {
          const listBody = await listRes.json();
          if (!cancelled) setAllConversations(listBody.conversations ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function handleSubmit(e: FormEvent | null) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    setSending(true);

    localIdRef.current += 1;
    const userMsgId = `local-user-${localIdRef.current}`;
    localIdRef.current += 1;
    const assistantMsgId = `local-asst-${localIdRef.current}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text },
      { id: assistantMsgId, role: "assistant", blocks: [] },
    ]);

    try {
      const res = await authFetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversation?.id ?? null,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Chat failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamErr: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt: unknown;
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (typeof evt !== "object" || !evt) continue;
          const ev = evt as Record<string, unknown>;
          handleStreamEvent(ev, assistantMsgId, text);
          if (ev.type === "error") {
            streamErr = (ev.message as string | undefined) ?? "Stream error";
          }
        }
      }
      if (streamErr) throw new Error(streamErr);

      void refreshConversationList();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setSending(false);
    }
  }

  function handleStreamEvent(
    ev: Record<string, unknown>,
    assistantMsgId: string,
    submittedText: string,
  ) {
    const type = ev.type as string | undefined;
    if (type === "meta" && typeof ev.conversation_id === "string") {
      const newId = ev.conversation_id;
      setConversation((prev) =>
        prev
          ? prev
          : {
              id: newId,
              title: submittedText.slice(0, 80),
              last_message_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
      );
    } else if (type === "text_delta" && typeof ev.text === "string") {
      const delta = ev.text;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMsgId || m.role !== "assistant") return m;
          const blocks = [...m.blocks];
          const last = blocks[blocks.length - 1];
          if (last?.kind === "text") {
            blocks[blocks.length - 1] = { ...last, text: last.text + delta };
          } else {
            blocks.push({ kind: "text", text: delta });
          }
          return { ...m, blocks };
        }),
      );
    } else if (
      type === "tool_use" &&
      typeof ev.id === "string" &&
      typeof ev.name === "string"
    ) {
      const id = ev.id;
      const name = ev.name;
      const inputVal = ev.input;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMsgId || m.role !== "assistant") return m;
          return {
            ...m,
            blocks: [...m.blocks, { kind: "tool", id, name, input: inputVal }],
          };
        }),
      );
    } else if (
      type === "tool_result" &&
      typeof ev.tool_use_id === "string"
    ) {
      const tuId = ev.tool_use_id;
      const output = ev.output;
      const isError = ev.is_error === true;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.role !== "assistant") return m;
          if (!m.blocks.some((b) => b.kind === "tool" && b.id === tuId)) return m;
          return {
            ...m,
            blocks: m.blocks.map((b) =>
              b.kind === "tool" && b.id === tuId
                ? { ...b, output, isError }
                : b,
            ),
          };
        }),
      );
    }
  }

  async function refreshConversationList() {
    try {
      const res = await authFetch("/api/agent/conversations");
      if (!res.ok) return;
      const body = await res.json();
      setAllConversations(body.conversations ?? []);
    } catch {
      // Silent.
    }
  }

  async function switchTo(id: string) {
    if (conversation?.id === id || sending) return;
    setError(null);
    setLoading(true);
    setDrawerOpen(false);
    try {
      const res = await authFetch(`/api/agent/conversations/${id}`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const body = await res.json();
      setConversation(body.conversation ?? null);
      setMessages(rowsToMessages(body.messages ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    if (sending) return;
    setError(null);
    setConversation(null);
    setMessages([]);
    setInput("");
    setDrawerOpen(false);
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id || sending) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/agent/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Delete failed (${res.status})`);
      }
      setAllConversations((prev) => prev.filter((c) => c.id !== id));
      // If the deleted thread is the one currently open, drop the user
      // back into the welcome state so they're not staring at messages
      // that no longer exist server-side.
      if (conversation?.id === id) {
        setConversation(null);
        setMessages([]);
      }
      setPendingDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  function sendStarter(prompt: string) {
    setInput(prompt);
    setTimeout(() => handleSubmit(null), 0);
  }

  // The chat route persists each tool-use iteration as its own assistant
  // row (assistant with [tool_use] → tool result row → assistant with
  // [text] → ...). For rendering purposes those iterations are one
  // logical turn — the user thinks "I asked one thing, the agent did
  // some work, and answered". Merge consecutive assistant rows so the
  // text-first / tools-after reorder inside AssistantMessageRow has all
  // the blocks of the turn to work with. Keeps the optimistic streaming
  // case (single assistant message) a no-op.
  const displayMessages = useMemo(() => {
    const out: Message[] = [];
    for (const msg of messages) {
      const last = out[out.length - 1];
      if (msg.role === "assistant" && last?.role === "assistant") {
        out[out.length - 1] = {
          ...last,
          blocks: [...last.blocks, ...msg.blocks],
        };
      } else {
        out.push(msg);
      }
    }
    return out;
  }, [messages]);

  const hasMessages = displayMessages.length > 0;
  const lastMsg = displayMessages[displayMessages.length - 1];
  // Show typing dots while sending AND the assistant message is empty
  // (no blocks yet, or only an empty text block).
  const showTypingDots =
    sending &&
    lastMsg?.role === "assistant" &&
    (lastMsg.blocks.length === 0 ||
      (lastMsg.blocks.length === 1 &&
        lastMsg.blocks[0].kind === "text" &&
        lastMsg.blocks[0].text.length === 0));

  return (
    <div
      className="flex flex-col w-full"
      style={{
        height: "calc(100dvh - 64px - var(--impersonation-banner-h, 0px))",
      }}
    >
      {/* Conversation switcher portaled into AppTopbar's tools slot — only
          rendered when the agent page is mounted, so it cleanly disappears
          on navigation away. */}
      {topbarPortal &&
        createPortal(
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(true);
              void refreshConversationList();
            }}
            aria-label="Conversation history"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            <FiClock className="h-4 w-4" />
          </button>,
          topbarPortal,
        )}

      {hasMessages ? (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 pt-12 pb-6 space-y-6">
              {displayMessages.map((m) =>
                m.role === "user" ? (
                  <UserMessageRow key={m.id} text={m.text} />
                ) : (
                  // Animate widgets only for messages that arrived this
                  // session (optimistic ids start with `local-`). Messages
                  // loaded from the DB — page reload, conversation switch,
                  // history hydration — render instantly so the user isn't
                  // watching the same stagger replay every time.
                  <AnimateProvider
                    key={m.id}
                    animate={m.id.startsWith("local-")}
                  >
                    <AssistantMessageRow blocks={m.blocks} />
                  </AnimateProvider>
                ),
              )}
              {showTypingDots && <TypingDots />}
            </div>
          </div>
          <div className="flex-shrink-0 bg-[var(--color-content-bg)]">
            <div className="max-w-2xl mx-auto px-4 py-3">
              {error && <ErrorBanner message={error} />}
              <ChatInputForm
                input={input}
                setInput={setInput}
                onSubmit={handleSubmit}
                disabled={sending || loading}
                canSend={!sending && !loading && Boolean(input.trim())}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="max-w-xl w-full">
            {loading ? (
              <div className="flex justify-center"><TypingDots /></div>
            ) : (
              <>
                <h1 className="text-2xl font-medium text-[var(--color-fg)] mb-8">
                  {greeting(new Date().getHours())}
                  {firstName ? `, ${firstName}` : ""}
                </h1>
                {error && <ErrorBanner message={error} />}
                <ChatInputForm
                  input={input}
                  setInput={setInput}
                  onSubmit={handleSubmit}
                  disabled={sending || loading}
                  canSend={!sending && !loading && Boolean(input.trim())}
                  autoFocus
                />
                <div className="mt-10 flex flex-col items-start gap-6">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendStarter(p)}
                      className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* History drawer — slides in from the right at sm size. Hold the
          conversation list with proper room to grow + scroll. */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Conversations"
        size="sm"
      >
        <div className="space-y-1">
          {/* "New chat" is only useful when an existing conversation is
              open — on the welcome screen the user is already in a fresh
              chat, so the button would be a no-op. */}
          {conversation && (
            <button
              type="button"
              onClick={newChat}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors"
            >
              <FiPlus className="h-4 w-4 text-[var(--color-muted)]" />
              New chat
            </button>
          )}

          {allConversations.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-6 text-center">
              No past conversations.
            </div>
          ) : (
            <div className={conversation ? "pt-2" : ""}>
              {allConversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={conversation?.id === c.id}
                  onClick={() => switchTo(c.id)}
                  onDelete={() => setPendingDeleteId(c.id)}
                />
              ))}
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  active,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  // Compute relative time once on mount so we don't trigger the purity
  // rule by calling Date.now() inside render.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const title = conversation.title?.trim() || "Untitled";

  return (
    <div
      className={`group relative flex items-center gap-1 rounded-md transition-colors ${
        active
          ? "bg-[var(--color-surface-alt)]"
          : "hover:bg-[var(--color-surface-alt)]/60"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left px-2 py-1.5"
      >
        <div className="text-sm text-[var(--color-fg)] truncate">{title}</div>
        <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
          {now !== null ? formatRelative(conversation.last_message_at, now) : ""}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete conversation"
        className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 mr-1 rounded-md text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-fg)]/[0.08] hover:text-[var(--color-danger)] transition-opacity"
      >
        <FiTrash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const INPUT_MAX_HEIGHT_PX = 160;

function ChatInputForm({
  input,
  setInput,
  onSubmit,
  disabled,
  canSend,
  autoFocus = false,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent | null) => void;
  disabled: boolean;
  canSend: boolean;
  autoFocus?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
  }, [input]);

  const hasText = input.trim().length > 0;

  return (
    <form onSubmit={onSubmit} className="relative">
      <textarea
        ref={taRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(null);
          }
        }}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder="Ask anything…"
        rows={1}
        style={{ maxHeight: `${INPUT_MAX_HEIGHT_PX}px` }}
        className="w-full resize-none pl-4 pr-12 py-2.5 text-sm rounded-2xl bg-[var(--color-surface-alt)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/15 disabled:opacity-60 overflow-y-auto"
      />
      <AnimatePresence>
        {hasText && (
          <motion.button
            key="send"
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            initial={{ opacity: 0, scale: 0.85, y: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{
              opacity: 0,
              scale: 0.85,
              y: "-50%",
              transition: { type: "tween", duration: 0.1, ease: "easeOut" },
            }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="absolute right-2 top-1/2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <FiArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  );
}

function UserMessageRow({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-[var(--color-surface-alt)] text-sm text-[var(--color-fg)] whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}

function AssistantMessageRow({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return <div className="text-sm text-[var(--color-fg)]"> </div>;
  }

  // Render text first, then tool widgets — within a single assistant
  // message, the model's prose answer reads as the response and the
  // tool result widgets feel like the supporting evidence below it.
  // The system prompt asks the model to call tools first then write
  // text, which means in document order the widget would appear above
  // an empty text region; reordering on render fixes that without
  // changing the underlying message structure.
  const textBlocks: TextBlock[] = [];
  const toolBlocks: ToolBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "text") textBlocks.push(b);
    else toolBlocks.push(b);
  }

  return (
    <div className="text-sm text-[var(--color-fg)]">
      {textBlocks.map((b, i) => (
        <MarkdownText key={`t-${i}`} text={b.text} />
      ))}
      {toolBlocks.map((b) => (
        <ToolWidget key={b.id} tool={b as ToolBlockData} />
      ))}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const html = useMemo(() => {
    if (!text) return "";
    try {
      return marked.parse(text, { gfm: true, breaks: true }) as string;
    } catch {
      return text;
    }
  }, [text]);

  if (!text) return null;

  return (
    <div
      className="leading-relaxed
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
        [&_p]:my-3
        [&_strong]:font-semibold
        [&_em]:italic
        [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[var(--color-muted)] hover:[&_a]:decoration-[var(--color-fg)]
        [&_ul]:list-disc [&_ul]:my-3 [&_ul]:pl-5
        [&_ol]:list-decimal [&_ol]:my-3 [&_ol]:pl-5
        [&_li]:my-1 [&_li>p]:my-0
        [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[var(--color-surface-alt)] [&_code]:text-[12px] [&_code]:font-mono
        [&_pre]:my-3 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:bg-[var(--color-surface-alt)] [&_pre]:overflow-x-auto [&_pre]:text-[12px]
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-[var(--color-muted)]
        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2
        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
        [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1
        [&_hr]:my-4 [&_hr]:border-[var(--color-border)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-2 px-3 py-2 rounded-md bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
      {message}
    </div>
  );
}
