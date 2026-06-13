/**
 * Hardcoded sample data for the Today feed mockup. Nothing here is wired
 * to a real agent yet — this exists to validate the surface: a feed of
 * things the agent handled or wants a decision on, instead of chat-first.
 */

export type FeedTone = "handled" | "decision";

export interface EvidenceRow {
  label: string;
  detail: string;
  amount?: string;
}

export interface FeedItem {
  id: string;
  tone: FeedTone;
  category: string;
  when: string;
  headline: string;
  /** What the agent did about it, 1-2 sentences. */
  body: string;
  evidence?: EvidenceRow[];
  /** Primary call to action — only on decision items. */
  action?: string;
  /** Shown after the user approves the action. */
  confirmation?: string;
  /** Rough annual dollar value of acting on this, for the dashboard signal. */
  stakes?: number;
}

export const FEED_ITEMS: FeedItem[] = [
  {
    id: "duplicate-adobe",
    tone: "decision",
    category: "Subscriptions",
    when: "Today",
    headline: "You're paying for Creative Cloud twice",
    body:
      "A second $52.99 Adobe subscription started in March, right when you switched plans — the old one never stopped billing. That's $635/yr if it keeps running.",
    evidence: [
      { label: "Mar 14", detail: "Adobe Creative Cloud · Visa ··4821", amount: "$52.99" },
      { label: "Mar 18", detail: "Adobe Systems · Amex ··1003", amount: "$52.99" },
      { label: "Apr 14", detail: "Adobe Creative Cloud · Visa ··4821", amount: "$52.99" },
      { label: "Apr 18", detail: "Adobe Systems · Amex ··1003", amount: "$52.99" },
    ],
    action: "Cancel the duplicate",
    confirmation:
      "Done. I'll cancel the subscription on the Amex and confirm here once Adobe processes it — usually within a day.",
    stakes: 636,
  },
  {
    id: "idle-cash",
    tone: "decision",
    category: "Cash",
    when: "Today",
    headline: "$14,200 of your emergency fund is earning 0.01%",
    body:
      "It's been sitting in Chase checking for 7 months. At 4.20% in a high-yield savings account that's about $590/yr you're leaving on the table.",
    evidence: [
      { label: "Now", detail: "Chase Total Checking · 0.01% APY", amount: "$1/yr" },
      { label: "Option", detail: "Marcus HYSA · 4.20% APY, no minimums", amount: "$596/yr" },
      { label: "Option", detail: "Ally Savings · 4.05% APY, buckets built in", amount: "$575/yr" },
    ],
    action: "Walk me through the move",
    confirmation:
      "I put a step-by-step in your tasks — opening the account takes about 10 minutes, and I'll watch for the transfer to land.",
    stakes: 590,
  },
  {
    id: "insurance-renewal",
    tone: "decision",
    category: "Insurance",
    when: "Yesterday",
    headline: "Geico wants $1,420 to renew — up $180, no claims",
    body:
      "Your renewal hits in 12 days. I pulled comparable quotes at the same coverage levels; the cheapest is $330 less per year.",
    evidence: [
      { label: "$1,420", detail: "Geico renewal · current coverage" },
      { label: "$1,090", detail: "State Farm · same coverage and deductibles" },
      { label: "$1,210", detail: "Progressive · adds roadside assistance" },
    ],
    action: "Draft the switch checklist",
    confirmation:
      "Drafted. Review the checklist before your renewal date — nothing changes until you say so.",
    stakes: 330,
  },
  {
    id: "categorized",
    tone: "handled",
    category: "Transactions",
    when: "Today",
    headline: "Categorized this week's 18 transactions",
    body:
      "Three were ambiguous — I filed the Costco run under Groceries based on your history, not Shopping. Tap any transaction to correct me and I'll remember.",
  },
  {
    id: "refund-matched",
    tone: "handled",
    category: "Returns",
    when: "Tuesday",
    headline: "Your $84.12 Amazon refund came through",
    body:
      "Matched it to the standing desk mat you returned on May 30. The original charge and refund now net out in your spending.",
  },
];

export interface AutonomyRule {
  id: string;
  action: string;
  note?: string;
  mode: "Auto" | "Ask first" | "Never";
}

export const AUTONOMY_RULES: AutonomyRule[] = [
  { id: "categorize", action: "Recategorize transactions", mode: "Auto" },
  {
    id: "tax-sweep",
    action: "Move money to savings buckets",
    note: "up to $500/wk",
    mode: "Auto",
  },
  { id: "cancel-dupes", action: "Cancel duplicate subscriptions", mode: "Ask first" },
  { id: "disputes", action: "Dispute charges", mode: "Ask first" },
  { id: "transfers", action: "Move money between accounts", mode: "Never" },
];

export const REVIEWED_SUMMARY =
  "Everything else checked out — 142 transactions, 6 accounts, and 4 recurring bills reviewed.";
