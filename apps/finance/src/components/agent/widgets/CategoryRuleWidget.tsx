"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag } from "react-icons/fi";
import { Button } from "@zervo/ui";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";
import { PagedList } from "./PagedList";

type Category = {
  id: string | null;
  label: string;
  hex_color: string;
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
};

type RuleCondition = {
  field: string;
  operator: string;
  value: string | number;
};

type MatchingTransaction = {
  id: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  date: string | null;
  icon_url: string | null;
  category_label: string | null;
  category_color: string | null;
  category_icon_lib: string | null;
  category_icon_name: string | null;
};

type RuleRelationship = 'identical' | 'new_narrows' | 'new_broadens';

type OverlappingRule = {
  rule_id: string;
  relationship: RuleRelationship;
  conditions: RuleCondition[];
  category: Category | null;
};

export type CategoryRuleData = {
  category: Category;
  conditions: RuleCondition[];
  reasoning: string | null;
  approx_match_count: number | null;
  // Optional: only present when the tool was rerun after this widget was
  // updated to surface a preview list. Older persisted conversations
  // won't have it.
  matching_transactions?: MatchingTransaction[];
  // Optional: existing rules that overlap with this proposal. Older
  // persisted widgets won't have it either.
  overlapping_rules?: OverlappingRule[];
  error?: string;
};

type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | {
      kind: "accepted";
      silent: boolean;
      appliedToExisting: number | null;
      replacedCount: number;
    }
  | { kind: "declined"; silent: boolean }
  | { kind: "failed"; message: string };

const FIELD_LABEL: Record<string, string> = {
  merchant_name: "merchant",
  description: "description",
  amount: "amount",
};

const OP_LABEL: Record<string, string> = {
  is: "is",
  equals: "equals",
  contains: "contains",
  starts_with: "starts with",
  is_greater_than: "is greater than",
  is_less_than: "is less than",
};

function categoryColor(cat: Category | null | undefined): string {
  if (!cat) return "#71717a";
  return cat.hex_color || cat.group_color || "#71717a";
}

function formatConditionValue(c: RuleCondition): string {
  if (c.field === "amount") {
    const num = Number(c.value);
    if (Number.isFinite(num)) {
      return `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }
  return String(c.value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function CategoryRuleWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: CategoryRuleData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });
  // Default: opt INTO retroactive application when there are matches —
  // the most natural ask ("auto-categorize Gemini going forward") usually
  // implies "and fix the existing ones too". Hidden when no matches.
  const [applyToExisting, setApplyToExisting] = useState(true);

  // Overlapping rules detected by the propose tool are ALWAYS replaced
  // when the user accepts the new rule. Asking the user to opt-in to
  // removing a rule that already overlaps (same conditions / narrower /
  // broader on the same axis) is pointless friction — keeping both
  // creates dead-weight duplicates and there's no scenario where the
  // user benefits from that. We still show the overlapping rules in
  // the widget so the user can see what's being replaced.
  const overlapping = data.overlapping_rules ?? [];
  const replaceIds = overlapping.map((r) => r.rule_id);

  // Mount-time check: did the user already accept/decline this proposal
  // in a previous session?
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
            setState({
              kind: "accepted",
              silent: true,
              appliedToExisting: null,
              replacedCount: 0,
            });
            return;
          }
          if (body.action === "declined") {
            setState({ kind: "declined", silent: true });
            return;
          }
        }
      } catch {
        // Fall through to idle.
      }
      if (!cancelled) setState({ kind: "idle" });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [toolUseId, data.error]);

  if (data.error) return <WidgetError message={data.error} />;

  const matchCount = data.approx_match_count ?? 0;
  const matchingTxs = data.matching_transactions ?? [];
  const showApplyToggle = matchCount > 0;

  async function handleAccept() {
    setState({ kind: "committing" });
    try {
      const res = await authFetch("/api/agent/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: data.category.id,
          conditions: data.conditions,
          apply_to_existing: showApplyToggle && applyToExisting,
          replace_rule_ids: replaceIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${res.status})`,
        );
      }
      const body = (await res.json().catch(() => ({}))) as {
        applied_to_existing?: number | null;
        replaced_rule_ids?: string[];
      };
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "accepted",
        }),
      });
      setState({
        kind: "accepted",
        silent: false,
        appliedToExisting: body.applied_to_existing ?? null,
        replacedCount: Array.isArray(body.replaced_rule_ids)
          ? body.replaced_rule_ids.length
          : 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setState({ kind: "failed", message });
    }
  }

  async function handleDecline() {
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
      // Silent.
    }
  }

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
            data={data}
            silent={state.silent}
            appliedToExisting={state.appliedToExisting}
            replacedCount={state.replacedCount}
          />
        ) : state.kind === "declined" ? (
          <ResolvedState
            key="declined"
            tone="declined"
            data={data}
            silent={state.silent}
            appliedToExisting={null}
            replacedCount={0}
          />
        ) : (
          <ProposalState
            key="proposal"
            data={data}
            matchingTxs={matchingTxs}
            overlapping={overlapping}
            committing={state.kind === "committing"}
            error={state.kind === "failed" ? state.message : null}
            showApplyToggle={showApplyToggle}
            applyToExisting={applyToExisting}
            onApplyToggle={setApplyToExisting}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Proposal — WHEN/SET rows, optional preview list, retroactive toggle,
// accept/decline. Order: rule → preview → toggle → buttons. The buttons
// sit BELOW the toggle so the action grouping reads top-down.
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  data,
  matchingTxs,
  overlapping,
  committing,
  error,
  showApplyToggle,
  applyToExisting,
  onApplyToggle,
  onAccept,
  onDecline,
}: {
  data: CategoryRuleData;
  matchingTxs: MatchingTransaction[];
  overlapping: OverlappingRule[];
  committing: boolean;
  error: string | null;
  showApplyToggle: boolean;
  applyToExisting: boolean;
  onApplyToggle: (v: boolean) => void;
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
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
          New rule
        </div>
        <div className="space-y-2.5">
          {data.conditions.map((c, i) => (
            <RuleConditionRow
              key={i}
              label={i === 0 ? "When" : "And"}
              condition={c}
            />
          ))}
          <RuleSetRow label="Set" cat={data.category} />
        </div>
      </div>

      {overlapping.length > 0 && (
        <ReplacesSection overlapping={overlapping} />
      )}

      {matchingTxs.length > 0 && (
        <MatchesSection
          matchingTxs={matchingTxs}
          targetCategory={data.category}
          animateToTarget={false}
        />
      )}

      {showApplyToggle && (
        <ApplyToExistingToggle
          count={data.approx_match_count ?? 0}
          checked={applyToExisting}
          onChange={onApplyToggle}
          disabled={committing}
        />
      )}

      {data.reasoning && (
        <p className="text-xs text-[var(--color-muted)] italic">
          {data.reasoning}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
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
          Create rule
        </Button>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Resolved — accepted/declined terminal state
// ──────────────────────────────────────────────────────────────────────────

function ResolvedState({
  tone,
  data,
  silent,
  appliedToExisting,
  replacedCount,
}: {
  tone: "accepted" | "declined";
  data: CategoryRuleData;
  silent: boolean;
  appliedToExisting: number | null;
  replacedCount: number;
}) {
  const matchingTxs = data.matching_transactions ?? [];
  const showMatches =
    tone === "accepted" &&
    matchingTxs.length > 0 &&
    appliedToExisting !== null &&
    appliedToExisting > 0;
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
          New rule
        </div>
        <div className="space-y-2.5">
          {data.conditions.map((c, i) => (
            <RuleConditionRow
              key={i}
              label={i === 0 ? "When" : "And"}
              condition={c}
              muted
            />
          ))}

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4 pt-1">
            <div className="min-w-0 md:flex-1">
              <RuleSetRow
                label={tone === "accepted" ? "Active" : "Skipped"}
                cat={data.category}
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
              {tone === "accepted" ? "Rule created" : "Rule declined"}
            </motion.div>
          </div>
        </div>
      </div>

      {/* When the user opted to also recategorize existing matches,
          show those rows again here with their icons and category
          labels animating into the new category — gives the action
          a tactile "yes, those just moved" feel rather than just a
          terse "Recategorized 3 transactions" line. */}
      {showMatches && (
        <MatchesSection
          matchingTxs={matchingTxs}
          targetCategory={data.category}
          animateToTarget={!silent}
        />
      )}

      {tone === "accepted" &&
        appliedToExisting !== null &&
        appliedToExisting > 0 &&
        !showMatches && (
          <div className="text-xs text-[var(--color-muted)]">
            {appliedToExisting === 1
              ? "Recategorized 1 existing transaction to match."
              : `Recategorized ${appliedToExisting} existing transactions to match.`}
          </div>
        )}

      {tone === "accepted" && replacedCount > 0 && (
        <div className="text-xs text-[var(--color-muted)]">
          {replacedCount === 1
            ? "Replaced 1 overlapping rule."
            : `Replaced ${replacedCount} overlapping rules.`}
        </div>
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

function RuleConditionRow({
  label,
  condition,
  muted = false,
}: {
  label: string;
  condition: RuleCondition;
  muted?: boolean;
}) {
  const field = FIELD_LABEL[condition.field] ?? condition.field;
  const op = OP_LABEL[condition.operator] ?? condition.operator;
  const value = formatConditionValue(condition);
  const isAmount = condition.field === "amount";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="truncate">
        <span className="text-[var(--color-muted)]">
          {field} {op}{" "}
        </span>
        <span
          className={
            muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)] font-medium"
          }
        >
          {isAmount ? value : `“${value}”`}
        </span>
      </span>
    </div>
  );
}

function RuleSetRow({
  label,
  cat,
  muted = false,
}: {
  label: string;
  cat: Category;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColor(cat) }}
        />
        <span
          className={`truncate ${
            muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
          }`}
        >
          {cat.label}
        </span>
      </span>
    </div>
  );
}

/**
 * Wraps the matches list with a contextual header. When every match
 * shares the same current category (the common "recategorize a
 * recurring pattern" case), the header swaps from a plain "EXISTING
 * MATCHES" label to a visual "Car Payment → Insurance" transition
 * indicator with category dots — so the change reads at a glance
 * without the user having to scan the per-row category labels.
 *
 * `animateToTarget`: when true (resolved/accepted state), each row's
 * icon background colour and category label crossfade to the target
 * category's colour/label with a small stagger. Gives the accept
 * action a tactile "yes, those just moved" feel.
 */
function MatchesSection({
  matchingTxs,
  targetCategory,
  animateToTarget,
}: {
  matchingTxs: MatchingTransaction[];
  targetCategory: Category;
  animateToTarget: boolean;
}) {
  const sharedFromCategory = useMemo(
    () => detectSharedCurrentCategory(matchingTxs),
    [matchingTxs],
  );
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
        {sharedFromCategory ? (
          <span className="inline-flex items-center gap-2">
            <span>Existing matches</span>
            <span className="text-[var(--color-muted)]/60">·</span>
            <CategoryPill
              label={sharedFromCategory.label}
              color={sharedFromCategory.color}
            />
            <span className="text-[var(--color-muted)]">→</span>
            <CategoryPill
              label={targetCategory.label}
              color={categoryColor(targetCategory)}
            />
          </span>
        ) : (
          <span>
            Existing matches{" "}
            <span className="text-[var(--color-muted)]/60">·</span>{" "}
            <span className="text-[var(--color-muted)]">→</span>{" "}
            <CategoryPill
              label={targetCategory.label}
              color={categoryColor(targetCategory)}
            />
          </span>
        )}
      </div>
      <PagedList
        items={matchingTxs}
        getKey={(tx) => tx.id}
        renderItem={(tx, index) => (
          <MatchingTransactionRow
            tx={tx}
            target={animateToTarget ? targetCategory : null}
            staggerIndex={index}
          />
        )}
        empty={null}
      />
    </div>
  );
}

/**
 * Inline category dot + label, sized to live inside the uppercase
 * mini-header next to "Existing matches". Reuses the muted header
 * typography so it doesn't shout louder than the section title.
 */
function CategoryPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--color-fg)] font-medium">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}

type SharedCategoryHint = { label: string; color: string };

function detectSharedCurrentCategory(
  txs: MatchingTransaction[],
): SharedCategoryHint | null {
  if (txs.length === 0) return null;
  const first = txs[0];
  if (!first.category_label) return null;
  const sharedLabel = first.category_label;
  const sharedColor = first.category_color;
  for (const tx of txs) {
    if (tx.category_label !== sharedLabel) return null;
    if (tx.category_color !== sharedColor) return null;
  }
  return { label: sharedLabel, color: sharedColor ?? "#71717a" };
}

/**
 * One row in the preview list. Same row shape as TransactionListWidget —
 * merchant icon + name + (date · current category) + amount.
 *
 * When `target` is set (resolved/accepted state), the icon's background
 * colour and the meta-line category label crossfade to the target
 * category with a small per-row stagger. The animation makes the
 * "these transactions just changed category" outcome land visually.
 */
function MatchingTransactionRow({
  tx,
  target,
  staggerIndex = 0,
}: {
  tx: MatchingTransaction;
  target: Category | null;
  staggerIndex?: number;
}) {
  const isIncome = tx.amount > 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <MerchantIcon
          iconUrl={tx.icon_url}
          color={tx.category_color}
          iconLib={tx.category_icon_lib}
          iconName={tx.category_icon_name}
          target={target}
          staggerIndex={staggerIndex}
        />
        <div className="min-w-0">
          <div className="text-sm text-[var(--color-fg)] truncate">
            {tx.merchant_name || tx.description}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] truncate">
            {formatDate(tx.date)}
            {target ? (
              <motion.span
                key={target.id ?? target.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 + staggerIndex * 0.08, duration: 0.3 }}
              >
                {` · ${target.label}`}
              </motion.span>
            ) : tx.category_label ? (
              ` · ${tx.category_label}`
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
      <div
        className={`text-sm tabular-nums flex-shrink-0 ${
          isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency(tx.amount)}
      </div>
    </div>
  );
}

/**
 * Renders the row icon. Three layers, in priority order:
 *  1. Plaid's merchant `icon_url` when available (real logo)
 *  2. A colored circle with the category icon (DynamicIcon)
 *  3. Generic tag icon fallback
 *
 * When `target` is supplied, the colored-circle and tag-fallback
 * branches animate their background colour and the inner icon glyph
 * to the target category's colour and icon. The image branch (a real
 * merchant logo) doesn't animate — the logo is the identity of the
 * merchant, not the category, so swapping its background would mostly
 * be invisible anyway.
 */
function MerchantIcon({
  iconUrl,
  color,
  iconLib,
  iconName,
  target,
  staggerIndex = 0,
}: {
  iconUrl: string | null;
  color: string | null;
  iconLib: string | null;
  iconName: string | null;
  target: Category | null;
  staggerIndex?: number;
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
  const fromColor = color || "var(--color-surface-alt)";
  const toColor = target ? categoryColor(target) : fromColor;
  const targetIconLib = target?.icon_lib ?? iconLib;
  const targetIconName = target?.icon_name ?? iconName;
  return (
    <motion.div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden"
      initial={false}
      animate={{ backgroundColor: toColor }}
      transition={{
        duration: 0.5,
        delay: target ? staggerIndex * 0.08 : 0,
        ease: "easeOut",
      }}
      style={{ backgroundColor: fromColor }}
    >
      {target ? (
        <>
          {/* Old icon fades out, new icon fades in — gives the icon
              glyph itself a real "this changed" beat even when the
              from/to colours are close. */}
          <motion.span
            key="from-icon"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{
              duration: 0.25,
              delay: staggerIndex * 0.08,
              ease: "easeOut",
            }}
          >
            <DynamicIcon
              iconLib={iconLib}
              iconName={iconName}
              className="h-3.5 w-3.5 text-white"
              fallback={FiTag}
              style={{ strokeWidth: 2.5 }}
            />
          </motion.span>
          <motion.span
            key="to-icon"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.25,
              delay: 0.3 + staggerIndex * 0.08,
              ease: "easeOut",
            }}
          >
            <DynamicIcon
              iconLib={targetIconLib}
              iconName={targetIconName}
              className="h-3.5 w-3.5 text-white"
              fallback={FiTag}
              style={{ strokeWidth: 2.5 }}
            />
          </motion.span>
        </>
      ) : (
        <DynamicIcon
          iconLib={iconLib}
          iconName={iconName}
          className="h-3.5 w-3.5 text-white"
          fallback={FiTag}
          style={{ strokeWidth: 2.5 }}
        />
      )}
    </motion.div>
  );
}

/**
 * Opt-in toggle to retroactively apply the rule. Defaults checked
 * because the most natural ask ("auto-categorize Gemini going forward")
 * usually implies "and fix the existing ones too".
 */
function ApplyToExistingToggle({
  count,
  checked,
  onChange,
  disabled,
}: {
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex items-center gap-2.5 text-xs text-left rounded-md hover:bg-[var(--color-surface-alt)]/40 transition-colors -mx-1 px-1 py-1 disabled:opacity-50"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors flex-shrink-0 ${
          checked
            ? "bg-[var(--color-fg)] border-[var(--color-fg)]"
            : "border-[var(--color-border)] bg-transparent"
        }`}
      >
        {checked && (
          <FiCheck
            className="h-3 w-3 text-[var(--color-bg)]"
            strokeWidth={3.5}
          />
        )}
      </span>
      <span className="text-[var(--color-fg)]">
        Also recategorize{" "}
        <span className="font-medium">
          {count === 1 ? "1 existing match" : `${count} existing matches`}
        </span>
      </span>
    </button>
  );
}

/**
 * Static "this will be replaced" listing for rules whose match space
 * overlaps with the new proposal. No toggle — overlapping rules are
 * always deleted on accept, because keeping a structurally-redundant
 * rule alongside the new one would just create dead-weight duplicates.
 * The strikethrough conditions are purely a "here's what's going
 * away" indicator for the user.
 */
function ReplacesSection({ overlapping }: { overlapping: OverlappingRule[] }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
        Replaces
      </div>
      <div className="space-y-2">
        {overlapping.map((rule) => (
          <OverlappingRuleRow key={rule.rule_id} rule={rule} />
        ))}
      </div>
    </div>
  );
}

function relationshipTag(rel: RuleRelationship): string {
  if (rel === "identical") return "same";
  if (rel === "new_narrows") return "broader";
  return "narrower";
}

/**
 * Single row in the "Replaces" section. Conditions are always shown
 * struck-through (this one IS being deleted on accept), with the
 * target category and relationship tag beneath. No interaction.
 */
function OverlappingRuleRow({ rule }: { rule: OverlappingRule }) {
  const summary = rule.conditions
    .map((c) => {
      const field = FIELD_LABEL[c.field] ?? c.field;
      const op = OP_LABEL[c.operator] ?? c.operator;
      const value =
        c.field === "amount"
          ? `$${Number(c.value).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : `“${c.value}”`;
      return `${field} ${op} ${value}`;
    })
    .join(" AND ");
  return (
    <div className="flex items-start gap-3 -mx-1 px-1 py-1">
      <span className="min-w-0 flex-1">
        <span className="block text-xs truncate text-[var(--color-muted)] line-through">
          {summary}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] truncate">
          {rule.category && (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryColor(rule.category) }}
              />
              <span className="truncate">{rule.category.label}</span>
              <span className="text-[var(--color-muted)]/60">·</span>
            </>
          )}
          <span className="italic">{relationshipTag(rule.relationship)}</span>
        </span>
      </span>
    </div>
  );
}
