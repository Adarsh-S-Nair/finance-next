"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
    // The URL itself is the canonical state, so loss of session memory
    // just means navigating away and back returns to the welcome
    // screen instead of resuming. Acceptable.
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
      // Synthetic user messages are widget-fired continuations
      // ("[user accepted...]") that drive the agent's next turn.
      // They live in the messages array as turn boundaries so the
      // displayMessages merge logic doesn't fuse two separate
      // assistant turns into one block, but they're filtered out
      // of the rendered chat.
      synthetic?: boolean;
    }
  | { id: string; role: "assistant"; blocks: Block[]; created_at: string };

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
};

// Persisted content shapes — we accept both legacy {text: string} and
// new {blocks: ...} on assistant rows. `synthetic` flags user
// messages fired by widgets (continuation triggers) so the chat UI
// can hide them.
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

// Inline timestamp shown under each message. Closer to a clock format
// than the conversation-list "5m ago" style — we want to know when a
// message was sent, not how stale it is.
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

// Convert a server row into the kind of content the UI cares about.
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
      // Synthetic user messages stay in the messages stream so the
      // displayMessages merge logic sees a boundary between
      // consecutive assistant turns. The render path filters them
      // out of the visible chat — they're context for the agent,
      // not text the user sees.
      messages.push({
        id: row.id,
        role: "user",
        text,
        created_at: row.created_at,
        ...(synthetic ? { synthetic: true } : {}),
      });
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
      messages.push({
        id: row.id,
        role: "assistant",
        blocks,
        created_at: row.created_at,
      });
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

/**
 * Main agent chat UI. Driven by `initialConversationId`:
 *
 * - `null` → welcome screen (used by /agent route). Sending the first
 *   message creates a new conversation server-side; on the meta event
 *   we silently update the URL to /agent/[new-id] via the History API
 *   so refresh / share / back all stay on this conversation.
 * - `string` → load that specific conversation (used by /agent/[id]
 *   route). The API rejects foreign ids with 404; on 404 we clear
 *   sessionStorage and bounce to /agent rather than show an error.
 *
 * Conversation switching uses real navigation (`router.push`) so the
 * URL reflects the current conversation. The page wrappers add
 * `key={id}` so React remounts this component on id change — clean
 * state, no bleed-through from the previous conversation.
 */
export default function AgentChat({
  initialConversationId,
}: {
  initialConversationId: string | null;
}) {
  const router = useRouter();
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

  const localIdRef = useRef(0);

  // Topbar portal for the conversation-history button.
  const [topbarPortal, setTopbarPortal] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopbarPortal(document.getElementById("topbar-tools-portal"));
  }, []);

  // `now` reference for inline message timestamps. Set once on mount so
  // formatMessageTime can decide today vs yesterday vs older without
  // hitting Date.now() in render (purity rule). The "X:YY PM" format
  // doesn't tick by, so re-rendering as time passes isn't useful.
  const [nowAtMount, setNowAtMount] = useState<number | null>(null);
  useEffect(() => setNowAtMount(Date.now()), []);

  // Initial load — depends on initialConversationId so navigating
  // between /agent and /agent/[id] re-fetches correctly. The page
  // wrappers add key={id} on the [id] route so this re-runs as a
  // remount rather than a re-effect, but the dependency array is
  // still correct for the welcome → conversation transition.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always pull the conversation list for the drawer, regardless
        // of which route we landed on.
        const listPromise = authFetch("/api/agent/conversations");

        if (initialConversationId) {
          // Load the specific conversation. The /api endpoint scopes by
          // user_id and returns 404 for foreign ids, so we can trust the
          // 404 path to mean "this id is not yours / not real".
          const convRes = await authFetch(
            `/api/agent/conversations/${initialConversationId}`,
          );
          if (cancelled) return;
          if (!convRes.ok) {
            // Stale id (in URL or sessionStorage). Clean up and bounce
            // to the welcome screen rather than show an error — the
            // user didn't ask to see this conversation explicitly,
            // they just had a stale tab session.
            writeSessionConvId(null);
            router.replace("/agent");
            return;
          }
          const body = await convRes.json();
          if (cancelled) return;
          setConversation(body.conversation ?? null);
          setMessages(rowsToMessages(body.messages ?? []));
          // Remember this for in-tab resume.
          writeSessionConvId(initialConversationId);
        }

        const listRes = await listPromise;
        if (cancelled) return;
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
  }, [initialConversationId, router]);

  // Auto-scroll the window to the bottom on new content. Previously this
  // scrolled an inner overflow-y-auto chat region, but that meant the
  // page had its own scrollbar separate from the rest of the app —
  // weird and inconsistent with /transactions etc. Now scrolling lives
  // at the document level, with the chat input pinned via sticky bottom.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, [messages, sending]);

  async function handleSubmit(e: FormEvent | null) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    setSending(true);

    // Optimistic user bubble + assistant placeholder. The user-facing
    // submit path always shows the user's message so the chat reflects
    // exactly what they typed.
    localIdRef.current += 1;
    const userMsgId = `local-user-${localIdRef.current}`;
    localIdRef.current += 1;
    const assistantMsgId = `local-asst-${localIdRef.current}`;
    const nowIso = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text, created_at: nowIso },
      { id: assistantMsgId, role: "assistant", blocks: [], created_at: nowIso },
    ]);

    await streamChatTurn({
      message: text,
      synthetic: false,
      assistantMsgId,
      submittedText: text,
    });
  }

  /**
   * Continuation path: a widget fired this on the user's behalf after
   * they clicked accept/decline. The synthetic user message is added
   * to the messages array as a turn boundary (so displayMessages won't
   * merge the previous assistant block with the new one), but it gets
   * filtered out of the rendered chat — the user never sees the
   * "[user accepted...]" text. The agent sees it as turn context.
   */
  async function handleContinuation(message: string) {
    if (sending) return; // Don't fire if a turn is already in flight.
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

  /**
   * Shared streaming logic for both handleSubmit (user typed) and
   * handleContinuation (widget fired). Builds the request, reads the
   * SSE stream, dispatches events. Caller is responsible for the
   * optimistic UI updates beforehand and for whatever cleanup makes
   * sense on error.
   */
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
      const res = await authFetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          synthetic,
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
          handleStreamEvent(ev, assistantMsgId, submittedText);
          if (ev.type === "error") {
            streamErr = (ev.message as string | undefined) ?? "Stream error";
          }
        }
      }
      if (streamErr) throw new Error(streamErr);

      void refreshConversationList();
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
      const isNewConversation = !conversation;
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
      // When the user starts a fresh conversation at /agent, the meta
      // event tells us its new id. Update the URL silently so refresh /
      // share / browser-back land back here. We use the History API
      // instead of router.replace to AVOID triggering a route remount
      // that would lose our in-memory streaming state.
      if (isNewConversation && initialConversationId === null) {
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/agent/${newId}`);
        }
        writeSessionConvId(newId);
      }
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

  function switchTo(id: string) {
    if (conversation?.id === id || sending) return;
    setError(null);
    setDrawerOpen(false);
    // Navigate to the conversation's permalink. The [id] page wrapper
    // remounts AgentChat with key={id}, giving us a clean state instead
    // of bleeding messages from the previous conversation while the new
    // one loads. The fetch happens inside the new instance's mount
    // useEffect.
    router.push(`/agent/${id}`);
  }

  function newChat() {
    if (sending) return;
    setError(null);
    setDrawerOpen(false);
    writeSessionConvId(null);
    if (initialConversationId !== null) {
      // We're on /agent/[id] — navigate to the welcome screen.
      router.push("/agent");
    } else {
      // Already on /agent — reset local state in place. This case
      // matters when the user has been chatting (URL pushed via
      // history.replaceState to /agent/[new-id] but route is still
      // the welcome page) and clicks New Chat.
      setConversation(null);
      setMessages([]);
      setInput("");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/agent");
      }
    }
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
      setPendingDeleteId(null);
      // If the deleted thread is the one currently open, navigate back
      // to the welcome screen rather than leave the user staring at
      // messages that no longer exist server-side. Clearing
      // sessionStorage too so a future tab refresh doesn't try to
      // resume a deleted conversation.
      if (conversation?.id === id) {
        writeSessionConvId(null);
        if (initialConversationId !== null) {
          router.push("/agent");
        } else {
          setConversation(null);
          setMessages([]);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/agent");
          }
        }
      }
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

  // Both states use the same vertical anchor: at least viewport-tall
  // minus the topbar minus the impersonation banner. That makes the
  // empty-state welcome center itself in the visible area, and gives the
  // messages-state's flex column something to fill so the sticky input
  // settles at the bottom of the viewport on first paint (before the
  // user has scrolled).
  const fullHeight = {
    minHeight: "calc(100dvh - 64px - var(--impersonation-banner-h, 0px))",
  } as const;

  return (
    <div className="w-full">
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
        <div className="flex flex-col" style={fullHeight}>
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 pt-12 pb-6 space-y-6">
            {displayMessages.map((m, i) => {
              // Synthetic user messages exist only as turn boundaries
              // for the merge logic — they're widget continuation
              // triggers, not text the user typed. Skip rendering.
              if (m.role === "user" && m.synthetic) return null;
              const isLastAssistant =
                m.role === "assistant" && i === displayMessages.length - 1;
              // Hide the timestamp on the currently-streaming response —
              // it's distracting next to typing dots and would just say
              // "just now / X:YY PM" before the content has even arrived.
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
                // Animate widgets only for messages that arrived this
                // session (optimistic ids start with `local-`). Messages
                // loaded from the DB — page reload, conversation switch,
                // history hydration — render instantly so the user isn't
                // watching the same stagger replay every time.
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
          {/* Sticky input bar — stays pinned to the viewport bottom while
              the rest of the chat scrolls with the document. The bg
              + slight top padding keep messages from visually bleeding
              into the input when scrolled. */}
          <div className="sticky bottom-0 z-30 bg-[var(--color-content-bg)] pt-2">
            <div className="max-w-2xl mx-auto px-4 pb-3">
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
        </div>
      ) : (
        <div
          className="flex items-center justify-center px-4 py-8"
          style={fullHeight}
        >
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

// Subtle "X:YY PM" line under each message. Mirrors the alignment of the
// message it belongs to so user timestamps land under the right-aligned
// bubble and assistant timestamps under the left-aligned response.
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
  // Fired by widgets after a successful accept/decline so the agent
  // can take the next turn without the user having to type "continue".
  // Optional because not every render path passes one (e.g. test
  // harnesses, future read-only viewers).
  onContinue?: (message: string) => void;
}) {
  if (blocks.length === 0) {
    return <div className="text-sm text-[var(--color-fg)]"> </div>;
  }

  // Render text first, then tool widgets. The model is prompted to call
  // tools first then write — so in DOM order text would appear after the
  // widget, which puts the response below the data. Reordering on render
  // gives us "answer then evidence" without changing the wire format.
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
        <ToolWidget key={b.id} tool={b as ToolBlockData} onContinue={onContinue} />
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
