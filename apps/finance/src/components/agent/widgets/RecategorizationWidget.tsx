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

// Local widget state — purely client-side, not persisted. After page
// reload the widget restarts at idle; clicking accept again is a no-op
// DB write. Acceptable tradeoff for not extending the message-block
// schema with widget state.
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

  // Declined → collapse to nothing. The agent's preceding prose
  // remains; user can still ask a follow-up.
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
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "accepted" ? (
          <AcceptedState
            key="accepted"
            tx={data.transaction}
            suggested={data.suggested_category}
          />
        ) : (
          <ProposalState
            key="proposal"
            tx={data.transaction}
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
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Proposal state
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  tx,
  current,
  suggested,
  reasoning,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  tx: Transaction;
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
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      {/* Transaction row — same visual language as TransactionListWidget. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MerchantIcon
            iconUrl={tx.icon_url}
            color={suggested.group_color ?? suggested.hex_color}
            iconLib={suggested.icon_lib}
            iconName={suggested.icon_name}
          />
          <div className="min-w-0">
            <div className="text-sm text-[var(--color-fg)] truncate">
              {tx.merchant_name || tx.description}
            </div>
            <div className="text-[11px] text-[var(--color-muted)] truncate">
              {formatDate(tx.date)}
            </div>
          </div>
        </div>
        <div className="text-sm tabular-nums text-[var(--color-fg)] flex-shrink-0">
          {tx.amount > 0 ? "+" : ""}
          {formatCurrency(tx.amount)}
        </div>
      </div>

      {/* Category change — colored dot + label, no pill chrome. */}
      <div className="flex items-center gap-2 text-sm flex-wrap pl-10">
        <CategoryLine cat={current} muted />
        <FiChevronRight
          className="h-3.5 w-3.5 text-[var(--color-muted)] flex-shrink-0"
          strokeWidth={2.5}
        />
        <CategoryLine cat={suggested} />
      </div>

      {reasoning && (
        <p className="text-[12px] text-[var(--color-muted)] leading-relaxed pl-10">
          {reasoning}
        </p>
      )}

      <div className="flex items-center justify-end gap-1 pt-1">
        {error && (
          <span className="text-[11px] text-rose-500 mr-2">{error}</span>
        )}
        <ActionButton
          tone="decline"
          onClick={onDecline}
          disabled={committing}
          aria-label="Decline suggestion"
        >
          <FiX className="h-4 w-4" strokeWidth={2.5} />
        </ActionButton>
        <ActionButton
          tone="accept"
          onClick={onAccept}
          disabled={committing}
          aria-label="Accept suggestion"
        >
          {committing ? (
            <SpinnerDot />
          ) : (
            <FiCheck className="h-4 w-4" strokeWidth={2.5} />
          )}
        </ActionButton>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Accepted state — magic burst on the merchant icon, then a subtle
// confirmation line. Stays minimal — no chips, no big banner, just a
// short note that the change happened.
// ──────────────────────────────────────────────────────────────────────────

function AcceptedState({
  tx,
  suggested,
}: {
  tx: Transaction;
  suggested: Category;
}) {
  const burstColor = suggested.group_color ?? suggested.hex_color;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3"
    >
      <div className="relative flex-shrink-0">
        {/* Soft color aura that scales out behind the icon. */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: burstColor }}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <Sparkles color={burstColor} />
        {/* Merchant icon with new category color, popping in. */}
        <motion.div
          initial={{ scale: 0.7 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 18 }}
          className="relative z-10"
        >
          <MerchantIcon
            iconUrl={tx.icon_url}
            color={burstColor}
            iconLib={suggested.icon_lib}
            iconName={suggested.icon_name}
          />
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.25 }}
        className="text-sm text-[var(--color-muted)]"
      >
        Recategorized to{" "}
        <span className="text-[var(--color-fg)]">{suggested.label}</span>
      </motion.div>
    </motion.div>
  );
}

function Sparkles({ color }: { color: string }) {
  // 6 particles flying outward, deterministic radial pattern (no
  // Math.random in render — purity rule).
  const angles = [0, 60, 120, 180, 240, 300];
  return (
    <>
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const dist = 22;
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(rad) * dist,
              y: Math.sin(rad) * dist,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

/**
 * Category line: a small colored circle (group color) + label text.
 * Replaces the previous pill chip — flat, no background, matches the
 * "no badge pills" rule from the style guide. The colored dot carries
 * category identity; the rest is plain text.
 */
function CategoryLine({
  cat,
  muted = false,
}: {
  cat: Category | null;
  muted?: boolean;
}) {
  if (!cat) {
    return (
      <span
        className={`text-[12px] italic ${
          muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
        }`}
      >
        Uncategorized
      </span>
    );
  }
  const dotColor = cat.group_color ?? cat.hex_color;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      >
        <DynamicIcon
          iconLib={cat.icon_lib}
          iconName={cat.icon_name}
          className="h-2.5 w-2.5 text-white"
          fallback={FiTag}
          style={{ strokeWidth: 2.5 }}
        />
      </span>
      <span
        className={`text-[12px] truncate ${
          muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
        }`}
      >
        {cat.label}
      </span>
    </span>
  );
}

/**
 * Small circular icon button used for accept/decline. Uses sentiment
 * colors only on hover — neutral muted by default so the buttons don't
 * compete with the rest of the message. emerald = accept, rose = decline.
 */
function ActionButton({
  children,
  onClick,
  disabled,
  tone,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "accept" | "decline";
} & React.AriaAttributes) {
  const toneClasses =
    tone === "accept"
      ? "hover:text-emerald-500 hover:bg-emerald-500/10"
      : "hover:text-rose-500 hover:bg-rose-500/10";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-muted)] ${toneClasses} disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-muted)] cursor-pointer disabled:cursor-not-allowed transition-colors`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

function MerchantIcon({
  iconUrl,
  color,
  iconLib,
  iconName,
}: {
  iconUrl: string | null;
  color: string;
  iconLib: string | null;
  iconName: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (iconUrl && !imageFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-7 h-7 rounded-full flex-shrink-0 object-cover bg-[var(--color-surface-alt)]"
      />
    );
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="h-3.5 w-3.5 text-white"
        fallback={FiTag}
        style={{ strokeWidth: 2.5 }}
      />
    </div>
  );
}

function SpinnerDot() {
  return (
    <motion.div
      className="h-3.5 w-3.5 rounded-full border-2 border-[var(--color-muted)] border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
