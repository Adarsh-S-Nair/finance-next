"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag } from "react-icons/fi";
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

// Local widget state. The "accepted_silent" variant skips the magic
// burst — used when the widget detects on mount that the change was
// already accepted in a previous session.
type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted"; silent: boolean }
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

/**
 * Pick the display color for a category. Mirrors how /api/plaid/transactions/get
 * resolves color: leaf system_category's hex_color first, parent
 * category_group's color as fallback. Inverting this (group first)
 * paints everything in the parent group's color and breaks distinct
 * leaves like Education (orange leaf inside the generic Other group).
 */
function categoryColor(cat: Category | null | undefined): string {
  if (!cat) return "#71717a";
  return cat.hex_color || cat.group_color || "#71717a";
}

export default function RecategorizationWidget({
  data,
}: {
  data: RecategorizationData;
}) {
  // Start in "checking" — we hit the API to see if the transaction is
  // already in the suggested category (i.e. the user accepted this
  // proposal in a previous session). While that's in flight, render
  // nothing visible to avoid a flash of accept/decline buttons that
  // immediately get replaced by the success state.
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await authFetch(
          `/api/agent/transaction-category?id=${encodeURIComponent(data.transaction.id)}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { category_id?: string | null };
          if (cancelled) return;
          if (body.category_id === data.suggested_category.id) {
            setState({ kind: "accepted", silent: true });
            return;
          }
        }
      } catch {
        // Fall through to idle on error — better to let the user
        // attempt to accept than block them on a connectivity issue.
      }
      if (!cancelled) setState({ kind: "idle" });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [data.transaction.id, data.suggested_category.id]);

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
      setState({ kind: "accepted", silent: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setState({ kind: "failed", message });
    }
  }

  function handleDecline() {
    setState({ kind: "declined" });
  }

  // Declined → collapse to nothing.
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

  // Checking → reserve space without flashing buttons. We render an
  // empty WidgetFrame at the same height as the proposal so the layout
  // doesn't jump when state resolves.
  if (state.kind === "checking") {
    return <WidgetFrame>{null}</WidgetFrame>;
  }

  return (
    <WidgetFrame>
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "accepted" ? (
          <AcceptedState
            key="accepted"
            tx={data.transaction}
            suggested={data.suggested_category}
            silent={state.silent}
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
// Proposal — bigger, more obvious, FROM/TO labels
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
  // Color resolution matches /api/plaid/transactions/get: prefer the
  // LEAF category's hex_color, fall back to the parent group. Earlier
  // versions had this inverted (group first), which painted everything
  // in the parent group's color — e.g. Education's leaf is orange, but
  // its parent group's color is generic purple, so we were showing
  // purple. The transactions page uses leaf-first; widgets should too.
  const proposalIconColor = categoryColor(current);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <TransactionHeader
        tx={tx}
        iconColor={proposalIconColor}
        iconLib={current?.icon_lib ?? null}
        iconName={current?.icon_name ?? null}
      />

      {/* FROM / TO change. Two rows with leading labels so the change
          reads as a deliberate before/after rather than a tossed-off
          chevron. Generous vertical spacing keeps it from feeling
          cramped. The colored dot does the visual lifting; the label
          is plain text. */}
      <div className="space-y-2.5 pl-14">
        <ChangeLine label="From" cat={current} muted />
        <ChangeLine label="To" cat={suggested} />
      </div>

      {reasoning && (
        <p className="text-[13px] text-[var(--color-muted)] leading-relaxed pl-14">
          {reasoning}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {error && (
          <span className="text-[11px] text-rose-500 mr-2">{error}</span>
        )}
        <ActionButton
          tone="decline"
          onClick={onDecline}
          disabled={committing}
          aria-label="Decline suggestion"
        >
          <FiX className="h-4 w-4" strokeWidth={2.75} />
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
            <FiCheck className="h-4 w-4" strokeWidth={2.75} />
          )}
        </ActionButton>
      </div>
    </motion.div>
  );
}

function ChangeLine({
  label,
  cat,
  muted = false,
}: {
  label: string;
  cat: Category | null;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-8 flex-shrink-0">
        {label}
      </span>
      {cat ? (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <CategoryDot color={categoryColor(cat)} />
          <span
            className={`truncate ${
              muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
            }`}
          >
            {cat.label}
          </span>
        </span>
      ) : (
        <span
          className={`italic ${
            muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
          }`}
        >
          Uncategorized
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Accepted — keep the transaction visible; show the new category +
// recategorized confirmation. Magic burst plays on first acceptance;
// a remount that detects "already accepted" skips it (silent=true).
// ──────────────────────────────────────────────────────────────────────────

function AcceptedState({
  tx,
  suggested,
  silent,
}: {
  tx: Transaction;
  suggested: Category;
  silent: boolean;
}) {
  // Same leaf-first resolution as the proposal — see comment in
  // ProposalState. The icon morphs to the suggested category's identity
  // on accept, with the merchant icon picking up the new color/icon.
  const burstColor = categoryColor(suggested);
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <TransactionHeader
        tx={tx}
        iconColor={burstColor}
        iconLib={suggested.icon_lib}
        iconName={suggested.icon_name}
        burst={!silent}
      />

      <div className="space-y-2 pl-14">
        <ChangeLine label="Now" cat={suggested} />
        <motion.div
          initial={silent ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: silent ? 0 : 0.3, duration: 0.25 }}
          className="flex items-center gap-1.5 text-xs text-emerald-500"
        >
          <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />
          Recategorized
        </motion.div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────────────

/**
 * Transaction header used by both proposal and accepted states.
 * Bigger merchant icon (10×10 = 40px, vs 7×7 elsewhere) because this
 * is a confirmation widget — we want the user to clearly see what
 * they're acting on, not skim past it.
 *
 * `burst=true` plays the magic acceptance animation on the icon:
 * a soft color aura scales out, six sparkles fly in a radial pattern,
 * and the icon itself springs in.
 */
function TransactionHeader({
  tx,
  iconColor,
  iconLib,
  iconName,
  burst = false,
}: {
  tx: Transaction;
  iconColor: string;
  iconLib: string | null;
  iconName: string | null;
  burst?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="relative flex-shrink-0">
        {burst && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: iconColor }}
              initial={{ scale: 0.7, opacity: 0.5 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
            <Sparkles color={iconColor} />
          </>
        )}
        <motion.div
          initial={burst ? { scale: 0.7 } : false}
          animate={burst ? { scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 360, damping: 18 }}
          className="relative z-10"
        >
          <MerchantIcon
            iconUrl={tx.icon_url}
            color={iconColor}
            iconLib={iconLib}
            iconName={iconName}
          />
        </motion.div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[15px] text-[var(--color-fg)] truncate font-medium">
            {tx.merchant_name || tx.description}
          </div>
          <div className="text-sm tabular-nums text-[var(--color-fg)] flex-shrink-0">
            {tx.amount > 0 ? "+" : ""}
            {formatCurrency(tx.amount)}
          </div>
        </div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          {formatDate(tx.date)}
        </div>
      </div>
    </div>
  );
}

/**
 * Solid colored dot for category identity. We tried embedding the
 * group icon inside, but leaves don't have icons in the schema and
 * adjacent leaves often share a parent group — so two different
 * categories rendered identical icons. A clean colored dot avoids
 * that confusion: color carries identity, label carries meaning.
 */
function CategoryDot({ color }: { color: string }) {
  return (
    <span
      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Accept (✓ emerald) and decline (✕ rose) icon-only buttons. Per
 * feedback: sentiment color is on by default, not just on hover —
 * makes the action obvious. Hover adds a subtle tinted background;
 * tap gives a small scale press.
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
  const colorClasses =
    tone === "accept"
      ? "text-emerald-500 hover:bg-emerald-500/10"
      : "text-rose-500 hover:bg-rose-500/10";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${colorClasses} disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors`}
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
        className="w-10 h-10 rounded-full flex-shrink-0 object-cover bg-[var(--color-surface-alt)]"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="h-5 w-5 text-white"
        fallback={FiTag}
        style={{ strokeWidth: 2.5 }}
      />
    </div>
  );
}

function Sparkles({ color }: { color: string }) {
  // 6 particles flying outward, deterministic radial pattern.
  const angles = [0, 60, 120, 180, 240, 300];
  return (
    <>
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const dist = 28;
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

function SpinnerDot() {
  return (
    <motion.div
      className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
