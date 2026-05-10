"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiClock } from "react-icons/fi";
import { marked } from "marked";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import ToolWidget, {
  type ToolBlock as ToolBlockData,
} from "./widgets/ToolWidget";
import { AnimateProvider } from "./widgets/primitives";
import AgentHistoryDrawer from "./AgentHistoryDrawer";

// sessionStorage key remembering the last conversation id viewed in
// this browser tab. New tabs / new devices have an empty session, so
// they always land on the welcome screen — fixes the "signed in on
// laptop, dropped into the desktop's recent conversation" weirdness.
// Scoped to the tab on purpose; localStorage would defeat the point.
const SESSION_KEY = "agent:lastConvId";

function readSessionConvId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionConvId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be disabled (private mode, etc) — silently ignore.
  }
}

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
  | {
      id: string;
      role: "user";
      text: string;
      created_at: string;
      synthetic?: boolean;
    }
  | { id: string; role: "assistant"; blocks: Block[]; created_at: string };

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
};

type StoredContent = {
  text?: unknown;
  blocks?: unknown;
  synthetic?: unknown;
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

function formatMessageTime(iso: string, now: number): string {
  const d = new Date(iso);
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const msgMidnight = new Date(d);
  msgMidnight.setHours(0, 0, 0, 0);
  const dayDelta = Math.round(
    (todayMidnight.getTime() - msgMidnight.getTime()) / 86_400_000,
  );
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (dayDelta === 0) return time;
  if (dayDelta === 1) return `Yesterday ${time}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${datePart} · ${time}`;
}

type DbRow = {
  id: string;
  role: string;
  content: StoredContent;
  created_at: string;
};

function rowsToMessages(rows: DbRow[]): Message[] {
  const messages: Message[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      const text = typeof row.content?.text === "string" ? row.content.text : "";
      if (!text) continue;
      const synthetic = row.content?.synthetic === true;
      messages.push({
        id: row.id,
        role: "user",
        text,
        created_at: row.created_at,
        ...(synthetic ? { synthetic: true } : {}),
      });
    } else if (row.role === "assistant") {
      const blocks: Block[] = [];
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
      messages.push({
        id: row.id,
        role: "assistant",
        blocks,
        created_at: row.created_at,
      });
    } else if (row.role === "tool") {
      const stored = row.content;
      if (!Array.isArray(stored?.blocks)) continue;
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
// Component
// ──────────────────────────────────────────────────────────────────────────

/**
 * Agent chat UI, rendered exclusively inside AgentOverlay. The overlay
 * remounts this component when it (re)opens, so initial state is driven
 * by props:
 *
 * - `initialConversationId` — load this conversation; on 404 fall back
 *   to the welcome screen.
 * - `initialMessage` — when set, fire as the first user turn after
 *   mount. Used by the bottom global input so the user types once and
 *   the overlay opens straight into a streaming response.
 *
 * Conversation switching and "new chat" are internal state changes —
 * we use a remount key (`switchKey`) to throw away streaming state
 * cleanly, the same way the old `/agent/[id]` page wrapper did via
 * `key={id}`.
 */
export default function AgentChat({
  initialConversationId,
  initialMessage,
}: {
  initialConversationId: string | null;
  initialMessage?: string | null;
}) {
  // Bumping this re-mounts the inner content so a "new chat" or
  // conversation switch starts from a clean slate without leaking
  // the previous turn's optimistic messages.
  const [switchKey, setSwitchKey] = useState(0);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    initialConversationId,
  );

  const switchConversation = useCallback((id: string | null) => {
    setActiveConvId(id);
    writeSessionConvId(id);
    setSwitchKey((k) => k + 1);
  }, []);

  return (
    <AgentChatInner
      key={switchKey}
      initialConversationId={activeConvId}
      // Only fire `initialMessage` on the very first mount — not on
      // conversation switches afterward.
      initialMessage={switchKey === 0 ? initialMessage ?? null : null}
      onSwitch={switchConversation}
    />
  );
}

function AgentChatInner({
  initialConversationId,
  initialMessage,
  onSwitch,
}: {
  initialConversationId: string | null;
  initialMessage: string | null;
  onSwitch: (id: string | null) => void;
}) {
  const userCtx = useUser() as { profile?: { first_name?: string | null } | null };
  const firstName = userCtx?.profile?.first_name ?? null;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const localIdRef = useRef(0);
  const conversationRef = useRef<Conversation | null>(null);
  conversationRef.current = conversation;

  const [nowAtMount, setNowAtMount] = useState<number | null>(null);
  useEffect(() => setNowAtMount(Date.now()), []);

  // Initial load + optional initialMessage send. Runs once per mount.
  // Conversation switches use a parent remount key, so this effect
  // re-runs cleanly per conversation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (initialConversationId) {
          const convRes = await authFetch(
            `/api/agent/conversations/${initialConversationId}`,
          );
          if (cancelled) return;
          if (!convRes.ok) {
            // Stale id (e.g. session pointing at a deleted conversation).
            // Drop the bad id and stay on the welcome screen.
            writeSessionConvId(null);
            onSwitch(null);
            return;
          }
          const body = await convRes.json();
          if (cancelled) return;
          setConversation(body.conversation ?? null);
          setMessages(rowsToMessages(body.messages ?? []));
          writeSessionConvId(initialConversationId);
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
  }, [initialConversationId, onSwitch]);

  // If the overlay was opened with an initialMessage (e.g. from the
  // bottom global input), fire it once we've finished the initial load.
  // Run only on first mount with a non-empty message.
  const initialMessageFired = useRef(false);
  useEffect(() => {
    if (initialMessageFired.current) return;
    if (!initialMessage) return;
    if (loading) return;
    initialMessageFired.current = true;
    void sendUserMessage(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialMessage]);

  // Auto-scroll on new content. The overlay is the scroll context here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.getElementById("agent-overlay-scroll");
    if (el) {
      el.scrollTop = el.scrollHeight;
    } else {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
  }, [messages, sending]);

  async function sendUserMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    setInput("");
    setSending(true);

    localIdRef.current += 1;
    const userMsgId = `local-user-${localIdRef.current}`;
    localIdRef.current += 1;
    const assistantMsgId = `local-asst-${localIdRef.current}`;
    const nowIso = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: trimmed, created_at: nowIso },
      { id: assistantMsgId, role: "assistant", blocks: [], created_at: nowIso },
    ]);

    await streamChatTurn({
      message: trimmed,
      synthetic: false,
      assistantMsgId,
      submittedText: trimmed,
    });
  }

  async function handleSubmit(e: FormEvent | null) {
    if (e) e.preventDefault();
    await sendUserMessage(input);
  }

  /**
   * Continuation path — widget fired this on the user's behalf after
   * accept/decline. Synthetic user messages are turn boundaries the
   * agent sees but the user doesn't.
   */
  async function handleContinuation(message: string) {
    if (sending) return;
    setError(null);
    setSending(true);

    localIdRef.current += 1;
    const userMsgId = `local-syn-${localIdRef.current}`;
    localIdRef.current += 1;
    const assistantMsgId = `local-asst-${localIdRef.current}`;
    const nowIso = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        text: message,
        created_at: nowIso,
        synthetic: true,
      },
      { id: assistantMsgId, role: "assistant", blocks: [], created_at: nowIso },
    ]);

    await streamChatTurn({
      message,
      synthetic: true,
      assistantMsgId,
      submittedText: message,
    });
  }

  async function streamChatTurn({
    message,
    synthetic,
    assistantMsgId,
    submittedText,
  }: {
    message: string;
    synthetic: boolean;
    assistantMsgId: string;
    submittedText: string;
  }) {
    try {
      const browserTz =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined;
      const res = await authFetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          synthetic,
          conversation_id: conversationRef.current?.id ?? null,
          timezone: browserTz,
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
          handleStreamEvent(ev, assistantMsgId, submittedText);
          if (ev.type === "error") {
            streamErr = (ev.message as string | undefined) ?? "Stream error";
          }
        }
      }
      if (streamErr) throw new Error(streamErr);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Failed to send";
      setError(errMessage);
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
      // Persist the new conversation id so a future overlay open in
      // this tab resumes here. No URL change anymore — the agent has
      // no public route.
      writeSessionConvId(newId);
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

  function switchTo(id: string) {
    if (conversation?.id === id || sending) return;
    setError(null);
    setDrawerOpen(false);
    onSwitch(id);
  }

  function newChat() {
    if (sending) return;
    setError(null);
    setDrawerOpen(false);
    onSwitch(null);
  }

  function handleDeleted(id: string) {
    // If the user deleted the conversation they're currently viewing,
    // bounce out to the welcome screen — staying on it would show
    // stale messages for a row that no longer exists server-side.
    if (conversation?.id === id) {
      onSwitch(null);
    }
  }

  function sendStarter(prompt: string) {
    setInput(prompt);
    setTimeout(() => handleSubmit(null), 0);
  }

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
  const showTypingDots =
    sending &&
    lastMsg?.role === "assistant" &&
    (lastMsg.blocks.length === 0 ||
      (lastMsg.blocks.length === 1 &&
        lastMsg.blocks[0].kind === "text" &&
        lastMsg.blocks[0].text.length === 0));

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* History trigger — top-left, parallel to the overlay's close
          button. Sits inside the overlay's stacking context so it
          only shows while the overlay is open. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Conversation history"
        className="absolute top-4 left-4 z-10 inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
      >
        <FiClock className="h-4 w-4" />
      </button>

      {hasMessages ? (
        <div
          id="agent-overlay-scroll"
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="max-w-2xl w-full mx-auto px-4 pt-16 pb-6 space-y-6">
            {displayMessages.map((m, i) => {
              if (m.role === "user" && m.synthetic) return null;
              const isLastAssistant =
                m.role === "assistant" && i === displayMessages.length - 1;
              const showStamp = !(isLastAssistant && sending);
              if (m.role === "user") {
                return (
                  <div key={m.id}>
                    <UserMessageRow text={m.text} />
                    {showStamp && nowAtMount !== null && (
                      <MessageTimestamp
                        ts={m.created_at}
                        now={nowAtMount}
                        align="right"
                      />
                    )}
                  </div>
                );
              }
              return (
                <AnimateProvider
                  key={m.id}
                  animate={m.id.startsWith("local-")}
                >
                  <AssistantMessageRow
                    blocks={m.blocks}
                    onContinue={handleContinuation}
                  />
                  {showStamp && nowAtMount !== null && (
                    <MessageTimestamp
                      ts={m.created_at}
                      now={nowAtMount}
                      align="left"
                    />
                  )}
                </AnimateProvider>
              );
            })}
            {showTypingDots && <TypingDots />}
          </div>
        </div>
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

      {hasMessages && (
        <div className="shrink-0">
          <div className="max-w-2xl mx-auto px-4 pt-2 pb-4">
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
      )}

      <AgentHistoryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeConversationId={conversation?.id ?? null}
        onSelect={switchTo}
        onNewChat={conversation ? newChat : undefined}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

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
        data-agent-chat-input
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

function MessageTimestamp({
  ts,
  now,
  align,
}: {
  ts: string;
  now: number;
  align: "left" | "right";
}) {
  return (
    <div
      className={`text-[10px] text-[var(--color-muted)]/70 mt-1 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {formatMessageTime(ts, now)}
    </div>
  );
}

function AssistantMessageRow({
  blocks,
  onContinue,
}: {
  blocks: Block[];
  onContinue?: (message: string) => void;
}) {
  if (blocks.length === 0) {
    return <div className="text-sm text-[var(--color-fg)]"> </div>;
  }

  return (
    <div className="text-sm text-[var(--color-fg)]">
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          <MarkdownText key={`t-${i}`} text={b.text} />
        ) : (
          <ToolWidget
            key={b.id}
            tool={b as ToolBlockData}
            onContinue={onContinue}
          />
        ),
      )}
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
