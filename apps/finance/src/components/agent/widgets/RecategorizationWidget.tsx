"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag } from "react-icons/fi";
import { Button } from "@zervo/ui";
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

// Local widget state. The `silent` flag on accepted/declined skips the
// entrance animation when the widget is rehydrating an action that
// happened in a previous session — the user already saw the animation
// the first time around.
type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted"; silent: boolean }
  | { kind: "declined"; silent: boolean }
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
 * Pick the display color for a category. Mirrors how
 * /api/plaid/transactions/get resolves color: leaf system_category's
 * hex_color first, parent category_group's color as fallback.
 */
function categoryColor(cat: Category | null | undefined): string {
  if (!cat) return "#71717a";
  return cat.hex_color || cat.group_color || "#71717a";
}

export default function RecategorizationWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: RecategorizationData;
}) {
  // checking: hitting /api/agent/widget-actions to see if the user
  // already accepted/declined this proposal in a previous session.
  // While that's in flight we render an empty WidgetFrame to reserve
  // space and avoid a flash of accept/decline buttons that immediately
  // get replaced.
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  // Mount-time: fetch the persisted action for this tool_use_id.
  // Source of truth = the database; the widget UI just renders it.
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
          if (body.action === "accepted") {
            setState({ kind: "accepted", silent: true });
            return;
          }
          if (body.action === "declined") {
            setState({ kind: "declined", silent: true });
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
  }, [toolUseId, data.error]);

  if (data.error) return <WidgetError message={data.error} />;

  async function handleAccept() {
    setState({ kind: "committing" });
    try {
      // Step 1: actually move the transaction to the suggested category.
      // This is the durable side effect the user is consenting to.
      const recatRes = await authFetch("/api/agent/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: data.transaction.id,
          category_id: data.suggested_category.id,
        }),
      });
      if (!recatRes.ok) {
        const body = await recatRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${recatRes.status})`,
        );
      }
      // Step 2: record the widget action so reload shows accepted state.
      // If this fails after the recategorize succeeded, the user sees
      // the proposal again on reload but accepting it is a harmless
      // no-op (tx already in target category) — we just retry then.
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "accepted",
        }),
      });
      setState({ kind: "accepted", silent: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setState({ kind: "failed", message });
    }
  }

  async function handleDecline() {
    // Optimistically flip to declined state — the API call below just
    // persists the choice. No durable side effect to roll back if it
    // fails; we'll re-record on next click.
    setState({ kind: "declined", silent: false });
    try {
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "declined",
        }),
      });
    } catch {
      // Silent. The state stays declined locally; on reload the user
      // sees the proposal again, can decline again. Acceptable.
    }
  }

  // Reserve space while we're checking persistent state.
  if (state.kind === "checking") {
    return <WidgetFrame>{null}</WidgetFrame>;
  }

  return (
    <WidgetFrame>
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "accepted" ? (
          <ResolvedState
            key="accepted"
            tone="accepted"
            tx={data.transaction}
            resolvedCategory={data.suggested_category}
            silent={state.silent}
          />
        ) : state.kind === "declined" ? (
          <ResolvedState
            key="declined"
            tone="declined"
            tx={data.transaction}
            resolvedCategory={data.current_category ?? data.suggested_category}
            silent={state.silent}
          />
        ) : (
          <ProposalState
            key="proposal"
            tx={data.transaction}
            current={data.current_category}
            suggested={data.suggested_category}
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
// Proposal state — accept/decline + FROM/TO change preview
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  tx,
  current,
  suggested,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  tx: Transaction;
  current: Category | null;
  suggested: Category;
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
      className="space-y-5"
    >
      <TransactionHeader
        tx={tx}
        iconColor={categoryColor(current)}
        iconLib={current?.icon_lib ?? null}
        iconName={current?.icon_name ?? null}
      />

      {/* FROM stays on its own row. TO sits in a flex row that pulls
          the buttons up next to it on desktop — visually "should we
          change to Fast Food? [yes/no]" reads as one decision. On
          mobile the buttons drop below; the chat is too narrow to
          fit a category line + two buttons on one row without
          either truncating the category or pinching the buttons. */}
      <div className="pl-14 space-y-2.5">
        <ChangeLine label="From" cat={current} muted />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            <ChangeLine label="To" cat={suggested} />
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            {error && (
              <span className="text-[11px] text-rose-500 mr-2">{error}</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onDecline}
              disabled={committing}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onAccept}
              loading={committing}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Resolved state (accepted or declined) — preserves the transaction
// header, replaces the FROM/TO + buttons with a status line. On the
// accepted path the merchant icon morphs color and bursts; on the
// declined path it stays in the current category's color.
// ──────────────────────────────────────────────────────────────────────────

function ResolvedState({
  tone,
  tx,
  resolvedCategory,
  silent,
}: {
  tone: "accepted" | "declined";
  tx: Transaction;
  resolvedCategory: Category;
  silent: boolean;
}) {
  const iconColor = categoryColor(resolvedCategory);
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <TransactionHeader
        tx={tx}
        iconColor={iconColor}
        iconLib={resolvedCategory.icon_lib}
        iconName={resolvedCategory.icon_name}
        burst={tone === "accepted" && !silent}
      />

      {/* Status indicator sits in the spot the buttons used to occupy:
          inline-right of the category row. Keeps the resolved layout
          on the same horizontal rhythm as the proposal. */}
      <div className="pl-14">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            <ChangeLine
              label={tone === "accepted" ? "Now" : "Stays"}
              cat={resolvedCategory}
              muted={tone === "declined"}
            />
          </div>
          <motion.div
            initial={silent ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: silent ? 0 : 0.3, duration: 0.25 }}
            className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${
              tone === "accepted"
                ? "text-emerald-500"
                : "text-[var(--color-muted)]"
            }`}
          >
            {tone === "accepted" ? (
              <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />
            ) : (
              <FiX className="h-3.5 w-3.5" strokeWidth={3} />
            )}
            {tone === "accepted" ? "Recategorized" : "Suggestion declined"}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────────────

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
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
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

/**
 * Solid colored dot for category identity. Color carries identity;
 * label carries meaning. We tried embedding a per-category icon
 * earlier, but adjacent leaves often share a parent group's icon, so
 * two different categories rendered identical icons.
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
 * Transaction header with optional magic burst on the merchant icon.
 * 10×10 icon (vs 7×7 in the transaction list widget) because this is
 * a confirmation widget — we want the user to clearly see what
 * they're acting on. `burst=true` plays the radial color aura +
 * sparkle particles + spring entrance on accept.
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
