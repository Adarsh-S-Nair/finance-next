"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUp } from "react-icons/fi";
import { authFetch } from "../../../lib/api/fetch";
import { useUser } from "../../../components/providers/UserProvider";
import { useNetWorth } from "../../../components/providers/NetWorthProvider";
import { formatCurrency } from "../../../lib/formatCurrency";

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

export default function AgentPage() {
  const userCtx = useUser() as { profile?: { first_name?: string | null } | null };
  const firstName = userCtx?.profile?.first_name ?? null;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          <div className="max-w-2xl w-full">
            {loading ? (
              <div className="text-center text-sm text-[var(--color-muted)]">Loading…</div>
            ) : (
              <>
                <h1 className="text-2xl font-medium text-[var(--color-fg)] mb-2">
                  {greeting(new Date().getHours())}
                  {firstName ? `, ${firstName}` : ""}
                </h1>

                <AgentNetWorthLine />

                <div className="mt-8" />

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

// One-line net worth indicator: label · number · inline sparkline · delta.
// Reads as a sentence/subtitle under the greeting. The inline SVG chart
// is so small it works as punctuation, not as a widget.
function AgentNetWorthLine() {
  const { currentNetWorth, netWorthHistory, loading } = useNetWorth();

  const series = useMemo(() => {
    if (!netWorthHistory) return [] as number[];
    return netWorthHistory
      .map((p) => (typeof p?.netWorth === "number" ? p.netWorth : null))
      .filter((v): v is number => v !== null);
  }, [netWorthHistory]);

  const percentChange = useMemo(() => {
    if (series.length < 2) return null;
    const oldest = series[0];
    const newest = series[series.length - 1];
    if (!oldest) return null;
    return ((newest - oldest) / Math.abs(oldest)) * 100;
  }, [series]);

  if (loading) {
    return (
      <div className="h-5 w-64 bg-[var(--color-surface-alt)]/60 rounded animate-pulse" />
    );
  }

  const netWorth = currentNetWorth?.netWorth;
  if (typeof netWorth !== "number" || netWorth === 0) return null;

  const isUp = percentChange === null ? null : percentChange >= 0;

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors group"
      aria-label="Open dashboard"
    >
      <span>Net worth</span>
      <span aria-hidden className="text-[var(--color-muted)]/50">·</span>
      <span className="font-medium text-[var(--color-fg)] tabular-nums">
        {formatCurrency(netWorth)}
      </span>
      {series.length >= 2 && (
        <InlineSparkline values={series} up={isUp ?? true} />
      )}
      {percentChange !== null && (
        <span
          className={`tabular-nums ${
            isUp ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {isUp ? "↑" : "↓"} {Math.abs(percentChange).toLocaleString("en-US", { maximumFractionDigits: 1 })}%
        </span>
      )}
    </Link>
  );
}

// Tiny inline chart sized like punctuation — 80×16, 1.25px stroke. Uses
// currentColor so it inherits the parent text color (muted by default,
// fg on group-hover). Pure SVG keeps it lightweight; no Recharts.
function InlineSparkline({ values, up }: { values: number[]; up: boolean }) {
  const width = 80;
  const height = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`flex-shrink-0 ${
        up ? "text-emerald-500/70" : "text-rose-500/70"
      }`}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Hard cap for the auto-grow textarea before it switches to scrolling.
// ~6 lines at typical line-height; tall enough to compose a thought,
// short enough to never push the send button off-screen.
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

  // Auto-grow: re-measure scrollHeight on every input change and pin the
  // height to that (capped at INPUT_MAX_HEIGHT_PX). Above the cap the
  // textarea's own overflow-y-auto takes over.
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
        // pr-12 reserves a 48px column on the right for the absolutely
        // positioned send button so long lines don't underrun it.
        className="w-full resize-none pl-4 pr-12 py-2.5 text-sm rounded-2xl bg-[var(--color-surface-alt)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]/15 disabled:opacity-60 overflow-y-auto"
      />
      {/* Vertically centered via top-1/2 + translateY(-50%) — the previous
          bottom-1.5 was mathematically perfect for a 40px single-line
          textarea but the rendered height varies slightly with browser
          font metrics, so the button drifted a couple px above center.
          translate-based centering is height-agnostic. For multi-line
          inputs the button stays at the visual middle of the composer,
          which (paired with pr-12 reserving the right column) keeps it
          clear of the text. AnimatePresence drives a subtle scale +
          spring entrance and a fast tween exit so the button doesn't
          appear to bounce-back during dismount. */}
      <AnimatePresence>
        {hasText && (
          <motion.button
            key="send"
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            // y stays pinned at -50% so the button remains vertically
            // centered on top: 50% across all three keyframes; scale +
            // opacity animate the entrance/exit.
            initial={{ opacity: 0, scale: 0.85, y: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{
              opacity: 0,
              scale: 0.85,
              y: "-50%",
              // Tween (not spring) on exit prevents framer-motion's
              // overshoot from briefly bouncing the button back into
              // view before dismount.
              transition: { type: "tween", duration: 0.1, ease: "easeOut" },
            }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="absolute right-2 top-1/2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            <FiArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
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
