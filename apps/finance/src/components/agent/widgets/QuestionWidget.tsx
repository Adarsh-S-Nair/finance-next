"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiHelpCircle, FiChevronRight } from "react-icons/fi";
import { Button } from "@zervo/ui";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

export type QuestionData =
  | {
      question: string;
      options: { label: string; value?: string }[];
      allow_custom?: boolean;
      context?: string | null;
      error?: string;
    }
  | { question?: undefined; error: string };

type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "custom"; draft: string }
  | { kind: "submitting"; selected: string }
  | { kind: "answered"; selected: string; silent: boolean }
  | { kind: "failed"; message: string };

/**
 * Inline widget for the agent to ask the user a structured question
 * with selectable options + optional free-form fallback.
 *
 * Pattern: agent calls ask_user_question when it hits ambiguity
 * ("are these high-variance deposits normal pay or bonuses?",
 * "which merchant did you mean?", etc). Widget renders the question +
 * one button per option + an Other... affordance. User clicks → fires
 * a synthetic continuation message back to the agent so the
 * conversation resumes with the answer in context.
 *
 * Soft enforcement: the chat input stays enabled. The widget is just
 * the path of least resistance for answering a multiple-choice
 * question — not a wall.
 */
export default function QuestionWidget({
  toolUseId,
  data,
  onContinue,
}: {
  toolUseId: string;
  data: QuestionData;
  onContinue?: (message: string) => void;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  useEffect(() => {
    if (data.error) return;
    let cancelled = false;
    async function check() {
      try {
        const res = await authFetch(
          `/api/agent/widget-actions/${encodeURIComponent(toolUseId)}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { action?: string | null };
          if (cancelled) return;
          // Question-widget answers are stored with an "answered:"
          // prefix to distinguish them from the binary accepted/
          // declined used by proposal widgets.
          const action = body.action ?? "";
          if (action.startsWith("answered:")) {
            setState({
              kind: "answered",
              selected: action.slice("answered:".length),
              silent: true,
            });
            return;
          }
        }
      } catch {
        // Fall through.
      }
      if (!cancelled) setState({ kind: "idle" });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [toolUseId, data.error]);

  if (data.error) return <WidgetError message={data.error} />;
  if (!data.question || !data.options) {
    return <WidgetError message="Invalid question" />;
  }

  const { question, options, context } = data;
  const allowCustom = data.allow_custom !== false;

  async function pick(value: string) {
    setState({ kind: "submitting", selected: value });
    try {
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: `answered:${value}`,
        }),
      });
    } catch {
      // Persistence is nice-to-have; even if it fails, fire the
      // continuation so the conversation moves forward.
    }
    setState({ kind: "answered", selected: value, silent: false });
    // Synthetic continuation — same shape as the budget/income
    // proposal widgets. Brackets signal to the agent that this is
    // a system-generated continuation, not a literal user message.
    onContinue?.(`[user answered: ${value}]`);
  }

  function startCustom() {
    setState({ kind: "custom", draft: "" });
  }

  return (
    <WidgetFrame>
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "checking" ? (
          <div key="checking" />
        ) : state.kind === "answered" ? (
          <AnsweredState
            key="answered"
            question={question}
            answer={state.selected}
            silent={state.silent}
          />
        ) : state.kind === "custom" ? (
          <CustomState
            key="custom"
            question={question}
            context={context ?? null}
            draft={state.draft}
            onChange={(v) => setState({ kind: "custom", draft: v })}
            onCancel={() => setState({ kind: "idle" })}
            onSubmit={() => {
              const v = state.draft.trim();
              if (v.length === 0) return;
              pick(v);
            }}
          />
        ) : (
          <IdleState
            key="idle"
            question={question}
            context={context ?? null}
            options={options}
            allowCustom={allowCustom}
            submitting={state.kind === "submitting"}
            selectedValue={
              state.kind === "submitting" ? state.selected : null
            }
            onPick={(label) => pick(label)}
            onCustom={startCustom}
            error={state.kind === "failed" ? state.message : null}
          />
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Idle (showing options)
// ──────────────────────────────────────────────────────────────────────────

function IdleState({
  question,
  context,
  options,
  allowCustom,
  submitting,
  selectedValue,
  onPick,
  onCustom,
  error,
}: {
  question: string;
  context: string | null;
  options: { label: string; value?: string }[];
  allowCustom: boolean;
  submitting: boolean;
  selectedValue: string | null;
  onPick: (label: string) => void;
  onCustom: () => void;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Header />
      <div className="pl-14 space-y-3">
        <div className="text-[14px] text-[var(--color-fg)] leading-relaxed">
          {question}
        </div>
        {context && (
          <div className="text-[12px] text-[var(--color-muted)] leading-relaxed">
            {context}
          </div>
        )}
        <div className="flex flex-col pt-1 -mx-2">
          {options.map((opt, i) => {
            const value = opt.value ?? opt.label;
            const isSelected = submitting && selectedValue === value;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(value)}
                disabled={submitting}
                className={`group flex items-center justify-between gap-3 text-left text-[13px] px-2 py-2 rounded-md transition-colors disabled:opacity-50 ${
                  isSelected
                    ? "bg-[var(--color-surface-alt)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/40"
                }`}
              >
                <span className="flex-1 min-w-0">{opt.label}</span>
                <FiChevronRight
                  className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${
                    isSelected
                      ? "text-[var(--color-fg)]"
                      : "text-[var(--color-muted)] group-hover:text-[var(--color-fg)]"
                  }`}
                />
              </button>
            );
          })}
          {allowCustom && (
            <button
              type="button"
              onClick={onCustom}
              disabled={submitting}
              className="text-left text-[12px] text-[var(--color-muted)] hover:text-[var(--color-fg)] px-2 py-2 transition-colors disabled:opacity-50"
            >
              Something else…
            </button>
          )}
        </div>
        {error && (
          <div className="text-[11px] text-[var(--color-danger)] mt-1">
            {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Custom (free-form answer)
// ──────────────────────────────────────────────────────────────────────────

function CustomState({
  question,
  context,
  draft,
  onChange,
  onCancel,
  onSubmit,
}: {
  question: string;
  context: string | null;
  draft: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      <Header />
      <div className="pl-14 space-y-3">
        <div className="text-[14px] text-[var(--color-fg)] leading-relaxed">
          {question}
        </div>
        {context && (
          <div className="text-[12px] text-[var(--color-muted)] leading-relaxed">
            {context}
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          rows={2}
          placeholder="Your answer…"
          className="w-full bg-[var(--color-surface-alt)]/40 border border-[var(--color-border)] focus:border-[var(--color-fg)] outline-none rounded-md px-3 py-2 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={draft.trim().length === 0}
          >
            Send
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Answered (resolved)
// ──────────────────────────────────────────────────────────────────────────

function AnsweredState({
  question,
  answer,
  silent,
}: {
  question: string;
  answer: string;
  silent: boolean;
}) {
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <Header />
      <div className="pl-14 space-y-2">
        <div className="text-[13px] text-[var(--color-muted)] leading-relaxed">
          {question}
        </div>
        <motion.div
          initial={silent ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: silent ? 0 : 0.2, duration: 0.25 }}
          className="flex items-center gap-2 text-[13px] text-[var(--color-fg)]"
        >
          <FiCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
          <span>{answer}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Header (shared)
// ──────────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--color-neon-blue)" }}
      >
        <FiHelpCircle
          className="h-5 w-5 text-white"
          strokeWidth={2.5}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-[var(--color-fg)] truncate font-medium">
          Quick question
        </div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          Pick an option or write your own answer
        </div>
      </div>
    </div>
  );
}
