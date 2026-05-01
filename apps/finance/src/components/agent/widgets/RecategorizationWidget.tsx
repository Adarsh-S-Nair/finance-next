"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiChevronRight, FiTag } from "react-icons/fi";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

type Category = {
  id: string | null;
  label: string;
  hex_color: string;
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
};

type Transaction = {
  id: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  date: string | null;
  icon_url: string | null;
};

export type RecategorizationData = {
  transaction: Transaction;
  current_category: Category | null;
  suggested_category: Category;
  reasoning: string | null;
  error?: string;
};

// Local widget state — purely client-side, not persisted. If the user
// reloads the conversation after accepting, the widget restarts at idle
// and clicking accept again is a no-op DB write. Acceptable tradeoff
// for not having to extend the message-block schema with widget state.
type WidgetState =
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted" }
  | { kind: "declined" }
  | { kind: "failed"; message: string };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function RecategorizationWidget({
  data,
}: {
  data: RecategorizationData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "idle" });

  if (data.error) return <WidgetError message={data.error} />;

  async function handleAccept() {
    setState({ kind: "committing" });
    try {
      const res = await authFetch("/api/agent/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: data.transaction.id,
          category_id: data.suggested_category.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${res.status})`,
        );
      }
      setState({ kind: "accepted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setState({ kind: "failed", message });
    }
  }

  function handleDecline() {
    setState({ kind: "declined" });
  }

  // Declined → collapse the widget to nothing. The agent's message
  // remains; the user can still ask follow-up questions.
  if (state.kind === "declined") {
    return (
      <motion.div
        initial={{ opacity: 1, height: "auto" }}
        animate={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: "hidden" }}
      />
    );
  }

  return (
    <WidgetFrame>
      <div className="rounded-xl border border-[var(--color-border)]/50 p-4 bg-[var(--color-surface-alt)]/30">
        {/* Transaction header */}
        <div className="flex items-center gap-3 mb-4">
          <TxIcon tx={data.transaction} fallbackColor={data.suggested_category.hex_color} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-[var(--color-fg)] truncate">
              {data.transaction.merchant_name || data.transaction.description}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              {formatDate(data.transaction.date)} ·{" "}
              <span className="tabular-nums">
                {formatCurrency(data.transaction.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Body morphs between proposal and accepted states */}
        <AnimatePresence mode="wait" initial={false}>
          {state.kind === "accepted" ? (
            <AcceptedState
              key="accepted"
              suggested={data.suggested_category}
            />
          ) : (
            <ProposalState
              key="proposal"
              current={data.current_category}
              suggested={data.suggested_category}
              reasoning={data.reasoning}
              committing={state.kind === "committing"}
              error={state.kind === "failed" ? state.message : null}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          )}
        </AnimatePresence>
      </div>
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Proposal state — categories side-by-side with accept/decline buttons
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  current,
  suggested,
  reasoning,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  current: Category | null;
  suggested: Category;
  reasoning: string | null;
  committing: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <CategoryChip cat={current} muted />
        </div>
        <FiChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <CategoryChip cat={suggested} />
        </div>
      </div>

      {reasoning && (
        <p className="text-[12px] text-[var(--color-muted)] mb-4 leading-relaxed">
          {reasoning}
        </p>
      )}

      {error && (
        <div className="text-[11px] text-[var(--color-danger)] mb-3">
          {error}. Try again?
        </div>
      )}

      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onAccept}
          disabled={committing}
          whileHover={{ scale: committing ? 1 : 1.02 }}
          whileTap={{ scale: committing ? 1 : 0.96 }}
          className="flex-1 inline-flex items-center justify-center gap-2 h-8 rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] text-xs font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          {committing ? (
            <SpinnerDot />
          ) : (
            <>
              <FiCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
              Accept
            </>
          )}
        </motion.button>
        <motion.button
          type="button"
          onClick={onDecline}
          disabled={committing}
          whileHover={{ scale: committing ? 1 : 1.02 }}
          whileTap={{ scale: committing ? 1 : 0.96 }}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 text-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <FiX className="h-3.5 w-3.5" strokeWidth={2.5} />
          Decline
        </motion.button>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Accepted state — magic animation + confirmation
// ──────────────────────────────────────────────────────────────────────────

function AcceptedState({ suggested }: { suggested: Category }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-3 py-2"
    >
      {/* Magic burst — radial scale of soft colored aura behind the chip */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: suggested.hex_color }}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Sparkle particles flying outward */}
        <Sparkles color={suggested.hex_color} />
        {/* The category chip pops in with a bounce */}
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: 0.05,
            type: "spring",
            stiffness: 360,
            damping: 16,
          }}
          className="relative z-10"
        >
          <CategoryChip cat={suggested} large />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex items-center gap-1.5 text-[12px] text-[var(--color-muted)]"
      >
        <FiCheck
          className="h-3.5 w-3.5 text-emerald-500"
          strokeWidth={2.75}
        />
        Recategorized
      </motion.div>
    </motion.div>
  );
}

function Sparkles({ color }: { color: string }) {
  // Eight particles flying out in a radial pattern. Deterministic so the
  // purity rule is happy (no Math.random in render).
  const particles = [
    { angle: 0 },
    { angle: 45 },
    { angle: 90 },
    { angle: 135 },
    { angle: 180 },
    { angle: 225 },
    { angle: 270 },
    { angle: 315 },
  ];
  return (
    <>
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const dist = 32;
        const x = Math.cos(rad) * dist;
        const y = Math.sin(rad) * dist;
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

function CategoryChip({
  cat,
  muted = false,
  large = false,
}: {
  cat: Category | null;
  muted?: boolean;
  large?: boolean;
}) {
  if (!cat) {
    return (
      <span className="text-[11px] text-[var(--color-muted)] italic">
        Uncategorized
      </span>
    );
  }
  const swatchColor = cat.group_color ?? cat.hex_color;
  const sizeClasses = large
    ? "h-8 px-3 gap-2 text-sm"
    : "h-6 px-2 gap-1.5 text-[11px]";
  const iconSize = large ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <div
      className={`inline-flex items-center rounded-full ${sizeClasses} ${
        muted
          ? "bg-[var(--color-surface-alt)]/60 text-[var(--color-muted)]"
          : "text-[var(--color-fg)]"
      }`}
      style={
        muted
          ? undefined
          : { backgroundColor: `${swatchColor}26`, color: undefined }
      }
    >
      <span
        className={`rounded-full flex items-center justify-center flex-shrink-0 ${
          large ? "h-5 w-5" : "h-4 w-4"
        }`}
        style={{ backgroundColor: swatchColor }}
      >
        <DynamicIcon
          iconLib={cat.icon_lib}
          iconName={cat.icon_name}
          className={`${iconSize} text-white`}
          fallback={FiTag}
          style={{ strokeWidth: 2.5 }}
        />
      </span>
      <span className="truncate">{cat.label}</span>
    </div>
  );
}

function TxIcon({
  tx,
  fallbackColor,
}: {
  tx: Transaction;
  fallbackColor: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (tx.icon_url && !imageFailed) {
    return (
      <img
        src={tx.icon_url}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-8 h-8 rounded-full flex-shrink-0 object-cover bg-[var(--color-surface-alt)]"
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: fallbackColor }}
    >
      <FiTag className="h-4 w-4 text-white" strokeWidth={2.5} />
    </div>
  );
}

function SpinnerDot() {
  return (
    <motion.div
      className="h-3.5 w-3.5 rounded-full border-2 border-[var(--color-bg)] border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
