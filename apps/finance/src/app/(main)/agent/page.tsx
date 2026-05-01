"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp, FiPlus, FiClock } from "react-icons/fi";
import { marked } from "marked";
import { authFetch } from "../../../lib/api/fetch";
import { useUser } from "../../../components/providers/UserProvider";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
};

type StoredContent = { text?: unknown };

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const t = (content as StoredContent).text;
    if (typeof t === "string") return t;
  }
  return "";
}

const STARTER_PROMPTS = [
  "How was my spending this month?",
  "Am I on track for my savings goals?",
  "What's my biggest recurring expense?",
  "Help me think through my budget.",
];

function greeting(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Pure formatter — no Date.now() so the purity rule stays happy. Caller
// passes "now" explicitly when they want a relative label, otherwise we
// fall back to absolute.
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);

  // Initial load: latest conversation + full conversation list, in parallel.
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
        setMessages(
          (latest.messages ?? [])
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { id: string; role: string; content: unknown }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              text: extractText(m.content),
            })),
        );

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

  // Autoscroll to bottom on new messages.
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
      { id: assistantMsgId, role: "assistant", text: "" },
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
          const ev = evt as {
            type?: string;
            conversation_id?: string;
            text?: string;
            message?: string;
          };
          if (ev.type === "meta" && ev.conversation_id) {
            const newId = ev.conversation_id;
            setConversation((prev) =>
              prev
                ? prev
                : {
                    id: newId,
                    title: text.slice(0, 80),
                    last_message_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                  },
            );
          } else if (ev.type === "delta" && typeof ev.text === "string") {
            const delta = ev.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, text: m.text + delta } : m,
              ),
            );
          } else if (ev.type === "error") {
            streamErr = ev.message ?? "Stream error";
          }
        }
      }
      if (streamErr) throw new Error(streamErr);

      // Refresh conversation list so the new (or just-bumped) thread floats to
      // the top of the switcher dropdown without a full reload.
      void refreshConversationList();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setSending(false);
    }
  }

  async function refreshConversationList() {
    try {
      const res = await authFetch("/api/agent/conversations");
      if (!res.ok) return;
      const body = await res.json();
      setAllConversations(body.conversations ?? []);
    } catch {
      // Silent — list stays stale until next load.
    }
  }

  async function switchTo(id: string) {
    if (conversation?.id === id || sending) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch(`/api/agent/conversations/${id}`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const body = await res.json();
      setConversation(body.conversation ?? null);
      setMessages(
        (body.messages ?? [])
          .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
          .map((m: { id: string; role: string; content: unknown }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            text: extractText(m.content),
          })),
      );
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
  }

  function sendStarter(prompt: string) {
    setInput(prompt);
    setTimeout(() => handleSubmit(null), 0);
  }

  const hasMessages = messages.length > 0;
  const lastMsg = messages[messages.length - 1];
  const showTypingDots =
    sending && lastMsg?.role === "assistant" && !lastMsg.text;

  return (
    <div
      className="flex flex-col w-full relative"
      style={{
        height: "calc(100dvh - 64px - var(--impersonation-banner-h, 0px))",
      }}
    >
      {/* Conversation switcher — anchored top-right of the agent page. */}
      <div className="absolute top-3 right-3 z-20">
        <ConversationSwitcher
          activeId={conversation?.id ?? null}
          conversations={allConversations}
          onSwitch={switchTo}
          onNew={newChat}
          onOpen={refreshConversationList}
        />
      </div>

      {hasMessages ? (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 pt-12 pb-6 space-y-6">
              {messages.map((m) => (
                <MessageRow key={m.id} role={m.role} text={m.text} />
              ))}
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
            // Hover bump + tap squish feel; framer-motion composes these
            // with the spring-mounted scale animation cleanly.
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

function MessageRow({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-[var(--color-surface-alt)] text-sm text-[var(--color-fg)] whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }
  // Assistant: full-width plain text, markdown rendered, no bubble.
  return (
    <div className="text-sm text-[var(--color-fg)]">
      <MarkdownText text={text} />
    </div>
  );
}

// Render markdown via `marked` (already a workspace dep). The output is
// trusted (it's the model's reply and we authenticate to the API), so we
// skip an extra DOMPurify pass for now. Tailwind arbitrary descendant
// selectors style the rendered tags so we don't need a global prose class.
function MarkdownText({ text }: { text: string }) {
  const html = useMemo(() => {
    if (!text) return "";
    try {
      // gfm: tables, strikethrough, etc. breaks: single \n becomes <br>.
      return marked.parse(text, { gfm: true, breaks: true }) as string;
    } catch {
      return text;
    }
  }, [text]);

  if (!text) return <span> </span>;

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

// ──────────────────────────────────────────────────────────────────────────
// Conversation switcher (top-right dropdown)
// ──────────────────────────────────────────────────────────────────────────

function ConversationSwitcher({
  activeId,
  conversations,
  onSwitch,
  onNew,
  onOpen,
}: {
  activeId: string | null;
  conversations: Conversation[];
  onSwitch: (id: string) => void;
  onNew: () => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Cache "now" at render of the open panel so each row's relative time
  // is stable for the duration of the popover (no purity warnings + no
  // distracting per-second drift while the user is reading).
  const [nowAtOpen, setNowAtOpen] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      onOpen();
      setNowAtOpen(Date.now());
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Conversation history"
        aria-expanded={open}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
      >
        <FiClock className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute top-9 right-0 w-72 rounded-xl bg-[var(--color-content-bg)] border border-[var(--color-border)] shadow-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors border-b border-[var(--color-border)]"
            >
              <FiPlus className="h-4 w-4 text-[var(--color-muted)]" />
              New chat
            </button>

            <div className="max-h-[60vh] overflow-y-auto py-1">
              {conversations.length === 0 ? (
                <div className="px-3.5 py-4 text-xs text-[var(--color-muted)] text-center">
                  No past conversations
                </div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeId;
                  const title = c.title?.trim() || "Untitled";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSwitch(c.id);
                        setOpen(false);
                      }}
                      className={`w-full flex flex-col items-start gap-0.5 px-3.5 py-2 text-left transition-colors ${
                        isActive
                          ? "bg-[var(--color-surface-alt)]"
                          : "hover:bg-[var(--color-surface-alt)]/60"
                      }`}
                    >
                      <span className="text-sm text-[var(--color-fg)] truncate w-full">
                        {title}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)]">
                        {nowAtOpen !== null
                          ? formatRelative(c.last_message_at, nowAtOpen)
                          : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
