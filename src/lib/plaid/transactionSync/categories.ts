/**
 * Pure category-planning functions for the transaction sync pipeline.
 *
 * These compute *diffs and plans* — they decide "what new rows need to be
 * created" and "which transactions should map to which category id" — but
 * they never touch the database. The orchestrator is responsible for
 * executing the IO based on these plans.
 */

import { formatCategoryName } from '../../categoryUtils';
import type {
  CategoryGroupRow,
  PlaidPersonalFinanceCategory,
  SystemCategoryRow,
  TransactionUpsertRow,
} from './types';

/**
 * Default icon for a newly-created category group. The legacy route had a
 * hardcoded lookup keyed by formatted group name; mirror it here verbatim.
 */
export const DEFAULT_CATEGORY_ICONS: Record<
  string,
  { icon_lib: string; icon_name: string }
> = {
  Income: { icon_lib: 'Fi', icon_name: 'FiDollarSign' },
  'Transfer In': { icon_lib: 'Fi', icon_name: 'FiArrowDownLeft' },
  'Transfer Out': { icon_lib: 'Fi', icon_name: 'FiArrowUpRight' },
  'Food and Drink': { icon_lib: 'Fi', icon_name: 'FiCoffee' },
  Entertainment: { icon_lib: 'Fi', icon_name: 'FiMusic' },
  Transportation: { icon_lib: 'Fi', icon_name: 'FiTruck' },
  Travel: { icon_lib: 'Fi', icon_name: 'FiMapPin' },
  'Rent and Utilities': { icon_lib: 'Fi', icon_name: 'FiHome' },
  Medical: { icon_lib: 'Fi', icon_name: 'FiHeart' },
  'Personal Care': { icon_lib: 'Fi', icon_name: 'FiSmile' },
  'General Merchandise': { icon_lib: 'Fi', icon_name: 'FiShoppingBag' },
  'General Services': { icon_lib: 'Fi', icon_name: 'FiBriefcase' },
  'Government and Non Profit': { icon_lib: 'Fi', icon_name: 'FiFlag' },
  'Home Improvement': { icon_lib: 'Fi', icon_name: 'FiTool' },
  'Loan Payments': { icon_lib: 'Fi', icon_name: 'FiCreditCard' },
  'Loan Disbursements': { icon_lib: 'Fi', icon_name: 'FiDownload' },
  'Bank Fees': { icon_lib: 'Fi', icon_name: 'FiAlertCircle' },
  Other: { icon_lib: 'Fi', icon_name: 'FiMoreHorizontal' },
};

export function getDefaultIconForGroup(
  formattedName: string
): { icon_lib: string; icon_name: string } {
  return DEFAULT_CATEGORY_ICONS[formattedName] ?? { icon_lib: 'Fi', icon_name: 'FiTag' };
}

/**
 * Return the set of formatted primary-category names present on the incoming
 * transactions. e.g. "FOOD_AND_DRINK" → "Food and Drink".
 */
export function extractPrimaryCategoryNames(
  rows: Pick<TransactionUpsertRow, 'personal_finance_category'>[]
): Set<string> {
  const primaries = new Set<string>();
  for (const row of rows) {
    const primary = row.personal_finance_category?.primary;
    if (primary) primaries.add(formatCategoryName(primary));
  }
  return primaries;
}

/**
 * Given the primary categories we want to exist and the groups that already
 * do, return the list of formatted names that still need to be created.
 *
 * Case-insensitive comparison to match the database's functional unique index.
 */
export function computeMissingCategoryGroupNames(
  wantedNames: Iterable<string>,
  existingGroups: Pick<CategoryGroupRow, 'name'>[]
): string[] {
  const existingLower = new Set(existingGroups.map((g) => g.name.toLowerCase()));
  const missing: string[] = [];
  for (const name of wantedNames) {
    if (!existingLower.has(name.toLowerCase())) missing.push(name);
  }
  return missing;
}

/**
 * Strip Plaid's `<PRIMARY>_` prefix from a detailed category key.
 * e.g. ("RENT_AND_UTILITIES_RENT", "RENT_AND_UTILITIES") → "RENT".
 *
 * Returns the original detailed string if the prefix doesn't match.
 */
export function stripPrimaryPrefix(detailed: string, primary: string): string {
  const prefix = primary + '_';
  return detailed.startsWith(prefix) ? detailed.substring(prefix.length) : detailed;
}

export interface CategoryLinkMaps {
  /** `plaid.detailed` → system_categories.id (primary lookup path) */
  plaidKeyToId: Map<string, string>;
  /** formatted label → system_categories.id (legacy/back-compat path) */
  labelToId: Map<string, string>;
}

export function buildCategoryLinkMaps(
  systemCategories: SystemCategoryRow[]
): CategoryLinkMaps {
  const plaidKeyToId = new Map<string, string>();
  const labelToId = new Map<string, string>();
  for (const c of systemCategories) {
    if (c.plaid_category_key) plaidKeyToId.set(c.plaid_category_key, c.id);
    labelToId.set(c.label, c.id);
  }
  return { plaidKeyToId, labelToId };
}

/**
 * Look up the system_categories.id for a given Plaid PFC object, using the
 * plaid_category_key as the primary path and falling back to the formatted
 * label for back-compat with rows seeded before plaid_category_key existed.
 */
export function resolveCategoryId(
  pfc: PlaidPersonalFinanceCategory | null | undefined,
  maps: CategoryLinkMaps
): string | null {
  if (!pfc?.detailed) return null;

  const byKey = maps.plaidKeyToId.get(pfc.detailed);
  if (byKey) return byKey;

  if (!pfc.primary) return null;
  const cleaned = stripPrimaryPrefix(pfc.detailed, pfc.primary);
  if (cleaned === pfc.detailed) return null; // prefix didn't match, no fallback
  const formattedLabel = formatCategoryName(cleaned);
  return maps.labelToId.get(formattedLabel) ?? null;
}

/**
 * Link rows to their system category id in-place. Returns the number of rows
 * that were successfully linked (for logging).
 */
export function linkRowsToCategories(
  rows: TransactionUpsertRow[],
  systemCategories: SystemCategoryRow[]
): number {
  const maps = buildCategoryLinkMaps(systemCategories);
  let linked = 0;
  for (const row of rows) {
    const id = resolveCategoryId(row.personal_finance_category, maps);
    if (id) {
      row.category_id = id;
      linked++;
    }
  }
  return linked;
}

export interface BackfillPlan {
  systemCategoryId: string;
  plaid_category_key: string;
}

/**
 * Compute which existing system_categories rows need a plaid_category_key
 * backfilled. Returns a list of {id, key} pairs the orchestrator can apply
 * with a simple update loop.
 *
 * NOTE: this mirrors the legacy route's behavior verbatim, which means it
 * uses the raw Plaid primary (e.g. "FOOD_AND_DRINK") as the lookup key
 * against category_groups.name — even though groups are stored in their
 * *formatted* form ("Food and Drink"). The result is that the backfill never
 * actually runs in practice. We preserve the bug here rather than silently
 * fixing it during a structural refactor. Fix in a separate, reviewed PR.
 *
 * TODO(category-backfill): look up groups by `formatCategoryName(pfc.primary)`
 * so the backfill actually runs, and add a migration to verify no regressions.
 */
export function computeBackfillPlan(
  rows: TransactionUpsertRow[],
  allGroups: CategoryGroupRow[],
  categoriesMissingKey: { id: string; label: string; group_id: string }[]
): BackfillPlan[] {
  // Group lookup by the *raw* stored name — see NOTE above.
  const groupNameToId = new Map<string, string>(allGroups.map((g) => [g.name, g.id]));

  // For each (label, group_id) implied by an incoming tx, remember the
  // plaid_category_key that produced it.
  const wantedKey = new Map<string, string>(); // `${label}__${group_id}` → plaid_category_key
  for (const row of rows) {
    const pfc = row.personal_finance_category;
    if (!pfc?.detailed || !pfc?.primary) continue;
    const groupId = groupNameToId.get(pfc.primary);
    if (!groupId) continue;
    const cleaned = stripPrimaryPrefix(pfc.detailed, pfc.primary);
    const label = formatCategoryName(cleaned);
    const key = `${label}__${groupId}`;
    if (!wantedKey.has(key)) wantedKey.set(key, pfc.detailed);
  }

  const plan: BackfillPlan[] = [];
  for (const cat of categoriesMissingKey) {
    const key = `${cat.label}__${cat.group_id}`;
    const plaidKey = wantedKey.get(key);
    if (plaidKey) plan.push({ systemCategoryId: cat.id, plaid_category_key: plaidKey });
  }
  return plan;
}
