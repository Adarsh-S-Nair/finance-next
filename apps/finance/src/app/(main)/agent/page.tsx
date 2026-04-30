"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FiSend } from "react-icons/fi";
import { authFetch } from "../../../lib/api/fetch";
import { useUser } from "../../../components/providers/UserProvider";

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

function formatNetWorth(value: number): string {
  // Compact for large numbers ($1.2M, $147k), full for under $10k.
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AgentPage() {
  const userCtx = useUser() as { profile?: { first_name?: string | null } | null };
  const firstName = userCtx?.profile?.first_name ?? null;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Net worth — fetched in parallel with conversation, never blocks chat.
  const [netWorth, setNetWorth] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Conversation load drives the loading spinner; net worth is
      // best-effort and won't block.
      try {
        const res = await authFetch("/api/agent/conversation");
        if (!res.ok) throw new Error(`Conversation load failed (${res.status})`);
        const conv = await res.json();
        if (cancelled) return;
        setConversation(conv.conversation ?? null);
        setMessages(
          (conv.messages ?? [])
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { id: string; role: string; content: unknown }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              text: extractText(m.content),
            })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await authFetch("/api/net-worth/current");
        if (!res.ok) return;
        const body = await res.json();
        const value = typeof body?.netWorth === "number" ? body.netWorth : null;
        if (!cancelled) setNetWorth(value);
      } catch {
        // Silent — the stat is decorative.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Autoscroll to bottom on new messages (only relevant in chat-mode layout).
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setSending(false);
    }
  }

  function sendStarter(prompt: string) {
    setInput(prompt);
    setTimeout(() => handleSubmit(null), 0);
  }

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col w-full"
      style={{
        height: "calc(100dvh - 64px - var(--impersonation-banner-h, 0px))",
      }}
    >
      {hasMessages ? (
        <>
          {/* Chat mode: messages scroll, input docked at bottom */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} text={m.text} />
              ))}
              {sending &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.text && (
                  <div className="text-xs text-[var(--color-muted)] italic px-3">
                    Thinking…
                  </div>
                )}
            </div>
          </div>
          <div className="flex-shrink-0 border-t border-[var(--color-border)]/50 bg-[var(--color-content-bg)]">
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
        // Empty mode: input centered vertically, suggestions listed beneath
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-xl w-full">
            {loading ? (
              <div className="text-center text-sm text-[var(--color-muted)]">Loading…</div>
            ) : (
              <>
                {netWorth !== null && netWorth !== 0 && (
                  <div className="text-center mb-10">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)] mb-1">
                      Net worth
                    </div>
                    <div className="text-3xl font-medium text-[var(--color-fg)] tabular-nums">
                      {formatNetWorth(netWorth)}
                    </div>
                  </div>
                )}
                <h1 className="text-2xl font-medium text-[var(--color-fg)] text-center mb-6">
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
                  size="lg"
                  autoFocus
                />
                <div className="mt-6 flex flex-col items-center gap-2">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendStarter(p)}
                      className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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

function ChatInputForm({
  input,
  setInput,
  onSubmit,
  disabled,
  canSend,
  size = "md",
  autoFocus = false,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent | null) => void;
  disabled: boolean;
  canSend: boolean;
  size?: "md" | "lg";
  autoFocus?: boolean;
}) {
  const isLg = size === "lg";
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
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
        className={
          isLg
            ? "flex-1 min-w-0 resize-none px-5 py-4 max-h-40 text-base rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]/60 text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/15 disabled:opacity-60"
            : "flex-1 min-w-0 resize-none px-4 py-2.5 max-h-32 text-sm rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/20 disabled:opacity-60"
        }
      />
      <button
        type="submit"
        disabled={!canSend}
        className={
          isLg
            ? "flex-shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-30 transition-opacity"
            : "flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-30 transition-opacity"
        }
        aria-label="Send"
      >
        <FiSend className={isLg ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </form>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-2 px-3 py-2 rounded-md bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
      {message}
    </div>
  );
}

function MessageBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[var(--color-fg)] text-[var(--color-bg)] text-sm whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-[var(--color-surface-alt)] text-[var(--color-fg)] text-sm whitespace-pre-wrap break-words">
        {text || " "}
      </div>
    </div>
  );
}
