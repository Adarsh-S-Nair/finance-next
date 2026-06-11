"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import PublicRoute from "../components/PublicRoute";
import AuthLoadingScreen from "../components/auth/AuthLoadingScreen";
import { BRAND } from "../config/brand";

// Real dashboard components — rendered with `mockData` so they skip
// network fetches but still use their production render paths. The
// dashboard components have a mix of typed/untyped props because they're
// authored in JSX/TSX. The shapes the landing page passes here are
// presentational mock data — match the in-file mock contract, not the
// component's strict prop type. Cast each component to a loose alias so
// the landing page doesn't have to chase every prop the production paths
// require (initialMonth, onBack, etc.).
import NetWorthBannerImport from "../components/dashboard/NetWorthBanner";
import MonthlyOverviewCardImport from "../components/dashboard/MonthlyOverviewCard";
import SpendingVsEarningCardImport from "../components/dashboard/SpendingVsEarningCard";
import TopCategoriesCardImport from "../components/dashboard/TopCategoriesCard";
import BudgetsCardImport from "../components/dashboard/BudgetsCard";
import CalendarCardImport from "../components/dashboard/CalendarCard";
import TopHoldingsCardImport from "../components/dashboard/TopHoldingsCard";
import InsightsCarouselImport from "../components/dashboard/InsightsCarousel";

type LooseProps = Record<string, unknown>;
const NetWorthBanner = NetWorthBannerImport as unknown as React.ComponentType<LooseProps>;
const MonthlyOverviewCard = MonthlyOverviewCardImport as unknown as React.ComponentType<LooseProps>;
const SpendingVsEarningCard = SpendingVsEarningCardImport as unknown as React.ComponentType<LooseProps>;
const TopCategoriesCard = TopCategoriesCardImport as unknown as React.ComponentType<LooseProps>;
const BudgetsCard = BudgetsCardImport as unknown as React.ComponentType<LooseProps>;
const CalendarCard = CalendarCardImport as unknown as React.ComponentType<LooseProps>;
const TopHoldingsCard = TopHoldingsCardImport as unknown as React.ComponentType<LooseProps>;
const InsightsCarousel = InsightsCarouselImport as unknown as React.ComponentType<LooseProps>;


/* ============================================================
   Demo data — generic, non-personal, realistic
   ============================================================ */

const NET_WORTH_MOCK = {
  netWorth: 48250,
  percentChange: 3.2,
  breakdown: {
    totalAssets: 49100,
    totalLiabilities: 850,
    assetSegments: [
      { label: "Cash", amount: 12300, color: "#059669" },
      { label: "Investments", amount: 36800, color: "var(--color-neon-green)" },
    ],
    liabilitySegments: [
      { label: "Credit", amount: 850, color: "#ef4444" },
      { label: "Loans", amount: 0, color: "#b91c1c" },
    ],
  },
};

const INSIGHTS_MOCK = {
  insights: [
    {
      id: "i1",
      title: "Upcoming Bills",
      priority: 1,
      message: "2 bills totaling $27 due this week.",
      tone: "neutral",
    },
    {
      id: "i2",
      title: "On Track",
      priority: 2,
      message: "You're spending 8% less than last month.",
      tone: "positive",
    },
    {
      id: "i3",
      title: "Budget Alert",
      priority: 3,
      message: "Shopping is at 68% of budget, with 12 days left in the month.",
      tone: "negative",
    },
  ],
};

interface MonthlyOverviewMock {
  availableMonths: { value: string; label: string }[];
  selectedMonth: string;
  previousMonthName: string;
  chartData: { dateString: string; spending: number; previousSpending: number }[];
}

// Build a realistic monthly-overview chart for the current month vs. last.
function buildMonthlyOverviewMock(): MonthlyOverviewMock {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Deterministic PRNG so the chart is identical between renders.
  function makeRand(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function genDaily(seed: number): number[] {
    const rand = makeRand(seed);
    const out: number[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      let amt: number;
      if (i === 0) {
        amt = 1120 + Math.floor(rand() * 130);
      } else {
        const p = rand();
        if (p < 0.35) amt = 0;
        else if (p < 0.75) amt = 5 + Math.floor(rand() * 30);
        else if (p < 0.92) amt = 40 + Math.floor(rand() * 70);
        else amt = 120 + Math.floor(rand() * 200);
      }
      out.push(amt);
    }
    return out;
  }

  const curDaily = genDaily(7);
  const prevDaily = genDaily(13);

  let curCum = 0;
  let prevCum = 0;
  const rawCur: number[] = [];
  const rawPrev: number[] = [];
  for (let i = 0; i < daysInMonth; i++) {
    curCum += curDaily[i];
    prevCum += prevDaily[i];
    rawCur.push(curCum);
    rawPrev.push(prevCum);
  }

  const curScale = rawCur[daysInMonth - 1] > 0 ? 2847 / rawCur[daysInMonth - 1] : 1;
  const prevScale = rawPrev[daysInMonth - 1] > 0 ? 3104 / rawPrev[daysInMonth - 1] : 1;

  const chartData = Array.from({ length: daysInMonth }, (_, i) => ({
    dateString: `${monthNames[month]} ${i + 1}`,
    spending: Math.round(rawCur[i] * curScale),
    previousSpending: Math.round(rawPrev[i] * prevScale),
  }));

  const selectedMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const prevMonthIdx = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevSelected = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, "0")}`;
  const previousMonthName = new Date(prevYear, prevMonthIdx, 1).toLocaleString("en-US", { month: "long" });

  return {
    availableMonths: [
      { value: selectedMonth, label: new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" }) },
      { value: prevSelected, label: new Date(prevYear, prevMonthIdx, 1).toLocaleString("en-US", { month: "long", year: "numeric" }) },
    ],
    selectedMonth,
    previousMonthName,
    chartData,
  };
}

const MONTHLY_OVERVIEW_MOCK = buildMonthlyOverviewMock();

const CASHFLOW_DATA = {
  data: (() => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const months: { monthName: string; monthNumber: number; year: number; earning: number; spending: number }[] = [];
    const values = [
      { earning: 4820, spending: 3210 },
      { earning: 4820, spending: 5380 },
      { earning: 4820, spending: 2960 },
      { earning: 5200, spending: 3104 },
      { earning: 4820, spending: 2847 },
      { earning: 6250, spending: 2654 },
    ];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = values[5 - i];
      months.push({
        monthName: monthNames[d.getMonth()],
        monthNumber: d.getMonth() + 1,
        year: d.getFullYear(),
        earning: v.earning,
        spending: v.spending,
      });
    }
    return months;
  })(),
};

const TOP_CATEGORIES_DATA = {
  categories: [
    { id: "rent", label: "Housing", total_spent: 1200, hex_color: "#a78bfa" },
    { id: "food", label: "Food & Drink", total_spent: 612, hex_color: "#f59e0b" },
    { id: "shopping", label: "Shopping", total_spent: 410, hex_color: "#60a5fa" },
    { id: "transport", label: "Transport", total_spent: 318, hex_color: "#34d399" },
    { id: "entertainment", label: "Entertainment", total_spent: 187, hex_color: "#f472b6" },
    { id: "other", label: "Other", total_spent: 120, hex_color: "#71717a" },
  ],
  totalSpending: 2847,
};

const BUDGETS_MOCK = [
  {
    id: "food",
    amount: 650,
    spent: 412,
    remaining: 238,
    category_groups: { name: "Food and Drink", icon_name: "Utensils" },
    system_categories: { label: "Food and Drink" },
  },
  {
    id: "shop",
    amount: 300,
    spent: 205,
    remaining: 95,
    category_groups: { name: "Shopping", icon_name: "ShoppingBag" },
    system_categories: { label: "Shopping" },
  },
  {
    id: "ent",
    amount: 150,
    spent: 78,
    remaining: 72,
    category_groups: { name: "Entertainment", icon_name: "Film" },
    system_categories: { label: "Entertainment" },
  },
];

function buildCalendarMock() {
  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };

  return {
    recurring: [
      { id: "r1", merchant_name: "Spotify", last_amount: 11.99, stream_type: "outflow", frequency: "MONTHLY", predicted_next_date: inDays(3), last_date: inDays(-27), category_hex_color: "#1db954", category_icon_lib: "Fi", category_icon_name: "FiMusic" },
      { id: "r2", merchant_name: "Netflix", last_amount: 15.49, stream_type: "outflow", frequency: "MONTHLY", predicted_next_date: inDays(5), last_date: inDays(-25), category_hex_color: "#e50914", category_icon_lib: "Fi", category_icon_name: "FiFilm" },
      { id: "r3", merchant_name: "Paycheck", last_amount: 2410, stream_type: "inflow", frequency: "BIWEEKLY", predicted_next_date: inDays(9), last_date: inDays(-5), category_hex_color: "#059669", category_icon_lib: "Fi", category_icon_name: "FiDollarSign" },
      { id: "r4", merchant_name: "Gym Membership", last_amount: 39.99, stream_type: "outflow", frequency: "MONTHLY", predicted_next_date: inDays(11), last_date: inDays(-19), category_hex_color: "#6366f1", category_icon_lib: "Fi", category_icon_name: "FiActivity" },
      { id: "r5", merchant_name: "Utilities", last_amount: 87.2, stream_type: "outflow", frequency: "MONTHLY", predicted_next_date: inDays(14), last_date: inDays(-16), category_hex_color: "#f59e0b", category_icon_lib: "Fi", category_icon_name: "FiZap" },
      { id: "r6", merchant_name: "Internet", last_amount: 64.99, stream_type: "outflow", frequency: "MONTHLY", predicted_next_date: inDays(22), last_date: inDays(-8), category_hex_color: "#0ea5e9", category_icon_lib: "Fi", category_icon_name: "FiWifi" },
    ],
  };
}

const CALENDAR_MOCK = buildCalendarMock();

const HOLDINGS_MOCK = {
  holdings: [
    { ticker: "VOO", shares: 48.2, avg_cost: 420, asset_type: "equity", marketValue: 23480 },
    { ticker: "AAPL", shares: 12, avg_cost: 175, asset_type: "equity", marketValue: 2610 },
    { ticker: "MSFT", shares: 8, avg_cost: 380, asset_type: "equity", marketValue: 3480 },
    { ticker: "NVDA", shares: 4, avg_cost: 650, asset_type: "equity", marketValue: 3820 },
    { ticker: "TLT", shares: 30, avg_cost: 98, asset_type: "bond", marketValue: 2740 },
  ],
  tickerMeta: {
    VOO: { name: "Vanguard S&P 500 ETF", assetType: "equity", logo: "https://www.google.com/s2/favicons?domain=vanguard.com&sz=128" },
    AAPL: { name: "Apple Inc.", assetType: "equity", logo: "https://www.google.com/s2/favicons?domain=apple.com&sz=128" },
    MSFT: { name: "Microsoft Corp.", assetType: "equity", logo: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128" },
    NVDA: { name: "NVIDIA Corp.", assetType: "equity", logo: "https://www.google.com/s2/favicons?domain=nvidia.com&sz=128" },
    TLT: { name: "iShares 20+ Year Treasury", assetType: "bond", logo: "https://www.google.com/s2/favicons?domain=ishares.com&sz=128" },
  },
  quotes: {
    VOO: { price: 487.13 },
    AAPL: { price: 217.5 },
    MSFT: { price: 435.1 },
    NVDA: { price: 955.2 },
    TLT: { price: 91.33 },
  },
  sparklines: {
    VOO: [465, 468, 470, 472, 475, 478, 480, 479, 481, 483, 485, 484, 486, 487],
    AAPL: [195, 198, 201, 205, 207, 210, 212, 213, 215, 214, 216, 217, 216, 217.5],
    MSFT: [410, 412, 415, 418, 420, 422, 425, 427, 428, 430, 432, 433, 434, 435],
    NVDA: [890, 895, 905, 910, 920, 930, 935, 942, 945, 948, 950, 952, 953, 955],
    TLT: [95, 94, 94, 93, 93, 92, 92, 92, 91, 91, 91, 91, 92, 91.33],
  },
};

/* ============================================================
   Shared bits
   ============================================================ */

const EASE = [0.2, 0.7, 0.3, 1] as const;

function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function BrandMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10" : "h-6 w-6";
  const text = size === "lg" ? "text-sm tracking-[0.2em]" : "text-[11px] tracking-[0.24em]";
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`block ${box} bg-[var(--color-fg)]`}
        style={{
          WebkitMaskImage: "url(/logo.svg)",
          maskImage: "url(/logo.svg)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
      <span
        className={`${text} font-semibold uppercase text-[var(--color-fg)]`}
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {BRAND.name}
      </span>
    </span>
  );
}

/* ============================================================
   Landing Nav
   ============================================================ */

export function LandingNav({ showLinks = true }: { showLinks?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerBg = scrolled
    ? "bg-[var(--color-content-bg)]/85 backdrop-blur border-b border-[var(--color-border)]"
    : "bg-transparent border-b border-transparent";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${headerBg}`}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <BrandMark />
        </Link>

        {showLinks && (
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 sm:flex">
              <a
                href="#features"
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                FAQ
              </a>
            </nav>
            <Link
              href="/auth?mode=signin"
              className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Sign in
            </Link>
            <Link
              href="/auth?mode=signup"
              className="hidden h-9 items-center justify-center rounded-full bg-[var(--color-fg)] px-4 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 sm:inline-flex"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

/* ============================================================
   Component showcase — real UI cards in floating panels with
   scroll-linked parallax, instead of a faked dashboard screenshot
   ============================================================ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-content-bg)] p-5 ${className}`}>
      {children}
    </div>
  );
}

const SHOWCASE_MASK = {
  maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
} as const;

function ShowcaseColumn({ y, delay, children }: { y: MotionValue<number>; delay: number; children: ReactNode }) {
  return (
    <motion.div style={{ y }} className="min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay }}
        className="space-y-6"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function HeroShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Each column drifts at its own speed as the page scrolls, so the
  // composition feels alive without any of it being interactive.
  const yLeft = useTransform(scrollYProgress, [0, 1], [48, -48]);
  const yCenter = useTransform(scrollYProgress, [0, 1], [110, -110]);
  const yRight = useTransform(scrollYProgress, [0, 1], [72, -72]);
  const yMobile = useTransform(scrollYProgress, [0, 1], [32, -32]);

  return (
    <div ref={ref} className="relative mx-auto mt-16 sm:mt-20" style={{ maxWidth: "min(92vw, 1200px)" }}>
      {/* Desktop: three columns at different parallax speeds */}
      <div className="hidden max-h-[640px] grid-cols-3 items-start gap-6 overflow-hidden pt-4 lg:grid" style={SHOWCASE_MASK}>
        <ShowcaseColumn y={yLeft} delay={0.3}>
          <Panel>
            <div className="h-[340px] min-w-0">
              <TopCategoriesCard data={TOP_CATEGORIES_DATA} />
            </div>
          </Panel>
          <Panel><InsightsCarousel mockData={INSIGHTS_MOCK} /></Panel>
          <Panel><BudgetsCard budgets={BUDGETS_MOCK} loading={false} /></Panel>
        </ShowcaseColumn>

        <ShowcaseColumn y={yCenter} delay={0.4}>
          <Panel><NetWorthBanner mockData={NET_WORTH_MOCK} /></Panel>
          <Panel>
            <div className="h-[280px] min-w-0">
              <MonthlyOverviewCard mockData={MONTHLY_OVERVIEW_MOCK} />
            </div>
          </Panel>
          <Panel><CalendarCard mockData={CALENDAR_MOCK} /></Panel>
        </ShowcaseColumn>

        <ShowcaseColumn y={yRight} delay={0.5}>
          <Panel>
            <div className="h-[300px] min-w-0">
              <SpendingVsEarningCard data={CASHFLOW_DATA} />
            </div>
          </Panel>
          <Panel><TopHoldingsCard mockData={HOLDINGS_MOCK} /></Panel>
        </ShowcaseColumn>
      </div>

      {/* Mobile: a single drifting column */}
      <div className="max-h-[560px] overflow-hidden pt-2 lg:hidden" style={SHOWCASE_MASK}>
        <ShowcaseColumn y={yMobile} delay={0.3}>
          <Panel><NetWorthBanner mockData={NET_WORTH_MOCK} /></Panel>
          <Panel>
            <div className="h-[260px] min-w-0">
              <MonthlyOverviewCard mockData={MONTHLY_OVERVIEW_MOCK} />
            </div>
          </Panel>
          <Panel><BudgetsCard budgets={BUDGETS_MOCK} loading={false} /></Panel>
        </ShowcaseColumn>
      </div>
    </div>
  );
}

// Feature visuals get a gentler version of the same scroll drift.
function ParallaxPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [32, -32]);
  return (
    <motion.div ref={ref} style={{ y }}>
      <Panel className="sm:p-7">{children}</Panel>
    </motion.div>
  );
}

/* ============================================================
   Feature rows — real product components as visuals
   ============================================================ */

interface FeatureRowProps {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: ReactNode;
  flip?: boolean;
}

function FeatureRow({ eyebrow, title, body, bullets, visual, flip = false }: FeatureRowProps) {
  return (
    <FadeIn>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div className={flip ? "lg:order-2" : ""}>
          <div className="card-header">{eyebrow}</div>
          <h3 className="mt-4 text-2xl font-medium tracking-tight text-[var(--color-fg)] sm:text-3xl">
            {title}
          </h3>
          <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">{body}</p>
          <ul className="mt-6 space-y-2.5 text-sm text-[var(--color-fg)]">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5">
                <span aria-hidden className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-[var(--color-fg)]" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className={flip ? "lg:order-1" : ""}>
          <ParallaxPanel>{visual}</ParallaxPanel>
        </div>
      </div>
    </FadeIn>
  );
}

/* ============================================================
   Pricing
   ============================================================ */

interface PricingColumnProps {
  price: string;
  tier: string;
  blurb: string;
  features: [boolean, string][];
  cta: string;
  highlighted?: boolean;
}

function PricingColumn({ price, tier, blurb, features, cta, highlighted = false }: PricingColumnProps) {
  return (
    <div className={highlighted ? "lg:border-l lg:border-[var(--color-border)] lg:pl-10" : "lg:pr-10"}>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums">
          ${price}
        </span>
        <span className="text-sm text-[var(--color-muted)]">/ month</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-fg)]">{tier}</span>
        {highlighted && <span className="card-header text-[var(--color-fg)]">Recommended</span>}
      </div>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{blurb}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map(([included, label]) => (
          <li
            key={label}
            className={`flex items-center gap-2.5 ${
              included
                ? "text-[var(--color-fg)]"
                : "text-[var(--color-muted)] line-through decoration-[var(--color-border)]"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-1 w-1 rounded-full ${
                included ? "bg-[var(--color-fg)]" : "bg-[var(--color-border)]"
              }`}
            />
            {label}
          </li>
        ))}
      </ul>

      <Link
        href="/auth?mode=signup"
        className={`mt-8 inline-flex h-10 w-full items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity ${
          highlighted
            ? "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90"
            : "ring-1 ring-inset ring-[var(--color-border)] text-[var(--color-fg)] hover:ring-[var(--color-fg)]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

/* ============================================================
   FAQ
   ============================================================ */

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Is the free plan really free?",
    a: "Yes. The free plan includes transactions, one connected account, and net worth history — no credit card required. Pro unlocks budgets, investments, recurring detection, paper trading, and unlimited accounts.",
  },
  {
    q: "How does Zervo connect to my bank?",
    a: "Through Plaid, the same service trusted by apps like Venmo and American Express. Your bank credentials go directly to Plaid — Zervo never sees or stores them, and the connection is strictly read-only.",
  },
  {
    q: "Can Zervo move my money?",
    a: "No. Zervo can read your transactions and balances to organize them for you, but it has no ability to initiate transfers, payments, or trades on any connected account.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes. Billing is handled by Stripe, and you can cancel from Settings at any time. You keep Pro access through the end of your billing period.",
  },
  {
    q: "What happens to my data if I leave?",
    a: "It's deleted. Removing your account wipes your transactions, balances, and bank connections from our systems.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-[var(--color-fg)]">{q}</span>
        <span
          aria-hidden
          className={`text-base text-[var(--color-muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-6 text-[var(--color-muted)]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

const HOW_IT_WORKS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Connect your accounts",
    body: "Link banks, cards, and brokerages through Plaid in about a minute. Your credentials never touch our servers.",
  },
  {
    step: "02",
    title: "Let it organize itself",
    body: "Transactions are categorized, recurring charges detected, and net worth tracked automatically from day one.",
  },
  {
    step: "03",
    title: "Decide with confidence",
    body: "Set budgets, scan your insights, and check the calendar. Five minutes a week is enough to stay on top of it.",
  },
];

const TRUST_ITEMS: { title: string; body: string }[] = [
  {
    title: "Encrypted at rest",
    body: "Bank connection tokens are encrypted with AES-256 before they ever touch the database.",
  },
  {
    title: "Read-only by design",
    body: "Zervo can see transactions and balances. It cannot move money, ever.",
  },
  {
    title: "Credentials never stored",
    body: "Bank logins go directly to Plaid. We never see your username or password.",
  },
  {
    title: "Your data is yours",
    body: "Export or delete everything, anytime. Leaving takes one click, not a support ticket.",
  },
];

const ALSO_INCLUDED: { title: string; body: string }[] = [
  { title: "Net worth history", body: "Every account rolled into one number, tracked over time." },
  { title: "Smart insights", body: "Surfaced automatically when something needs your attention." },
  { title: "Cash flow", body: "Earning vs. spending, month over month, at a glance." },
  { title: "Paper trading", body: "Test investment ideas without putting real money in." },
  { title: "Multiple accounts", body: "Banks, cards, and brokerages side by side in one view." },
  { title: "Light & dark themes", body: "A calm interface that matches how you work." },
];

export default function Home() {
  // OAuth sometimes redirects users to `/?code=...`. The inline script in
  // RootLayout handles this synchronously during HTML parsing; this check
  // is a React-side safety net in case the script is blocked or fails.
  const [isOAuthReturn] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("code");
  });

  useEffect(() => {
    if (!isOAuthReturn) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    window.location.replace(
      `/auth/callback/exchange?code=${encodeURIComponent(code)}&next=/dashboard`
    );
  }, [isOAuthReturn]);

  if (isOAuthReturn) {
    return <AuthLoadingScreen />;
  }

  return (
    <PublicRoute>
      <main className="min-h-screen bg-[var(--color-content-bg)] text-[var(--color-fg)]">
        <LandingNav />

        {/* ============ Hero ============ */}
        <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
            style={{
              background:
                "radial-gradient(ellipse 75% 60% at 50% -10%, color-mix(in oklab, var(--color-fg), transparent 95%), transparent)",
            }}
          />

          <div className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="text-4xl font-medium tracking-tight text-[var(--color-fg)] sm:text-5xl lg:text-6xl lg:leading-[1.05]"
                style={{ fontFamily: "var(--font-instrument)", letterSpacing: "-0.02em" }}
              >
                Know where every dollar goes.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                className="mx-auto mt-6 max-w-xl text-base leading-7 text-[var(--color-muted)] sm:text-lg"
              >
                Zervo connects to your banks and turns spending, budgets, and
                investments into one calm, organized picture. No spreadsheets,
                no manual entry.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Link
                  href="/auth?mode=signup"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-fg)] px-6 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90"
                >
                  Get started — it&apos;s free
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-[var(--color-fg)] ring-1 ring-inset ring-[var(--color-border)] transition-colors hover:ring-[var(--color-fg)]"
                >
                  See what&apos;s inside
                </a>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-4 text-xs text-[var(--color-muted)]"
              >
                Free plan available. No credit card required.
              </motion.p>
            </div>

            {/* Product showcase — real UI components drifting on scroll */}
            <HeroShowcase />
          </div>
        </section>

        {/* ============ Features ============ */}
        <section id="features" className="scroll-mt-20 border-t border-[var(--color-border)] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center">
              <div className="card-header">Features</div>
              <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Everything your money does, in one place.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[var(--color-muted)]">
                Every panel on this page is the actual product UI — the same
                components you&apos;ll use every day, not marketing mockups.
              </p>
            </FadeIn>

            <div className="mt-20 space-y-24 sm:mt-24 sm:space-y-32">
              <FeatureRow
                eyebrow="Spending"
                title="Every transaction, already sorted."
                body="Connect your accounts once and Zervo pulls in every transaction automatically — categorized and charted against last month, so you spot a trend the day it starts, not when the statement arrives."
                bullets={[
                  "Automatic import from every connected account",
                  "Smart categorization you can override anytime",
                  "This month vs. last, side by side",
                ]}
                visual={
                  <div className="h-[360px] min-w-0">
                    <MonthlyOverviewCard mockData={MONTHLY_OVERVIEW_MOCK} />
                  </div>
                }
              />

              <FeatureRow
                eyebrow="Budgets"
                title="Budgets that fill themselves in."
                body="Pick a category, set a number, and you're done. Progress updates on its own as you spend — no receipts to log, no spreadsheet to maintain, no guilt-trip notifications."
                bullets={[
                  "Per-category limits with live progress",
                  "Color shifts as you approach the line",
                  "Insights warn you before you go over",
                ]}
                flip
                visual={
                  <div className="min-w-0 space-y-8">
                    <InsightsCarousel mockData={INSIGHTS_MOCK} />
                    <BudgetsCard budgets={BUDGETS_MOCK} loading={false} />
                  </div>
                }
              />

              <FeatureRow
                eyebrow="Recurring"
                title="Know what's coming before it hits."
                body="Zervo detects subscriptions, bills, and paychecks from your transaction history, then lays them out on a calendar — so the end of the month never surprises you again."
                bullets={[
                  "Subscriptions and bills detected automatically",
                  "Predicted dates and amounts for each one",
                  "Paychecks tracked alongside the outflows",
                ]}
                visual={
                  <div className="min-w-0">
                    <CalendarCard mockData={CALENDAR_MOCK} />
                  </div>
                }
              />

              <FeatureRow
                eyebrow="Investing"
                title="Your portfolio lives here too."
                body="Holdings, live prices, and performance sit right beside your day-to-day money — so your net worth always reflects the whole picture, not just what's in checking."
                bullets={[
                  "Brokerage accounts synced like any other",
                  "Live quotes and sparklines per holding",
                  "Net worth that includes everything you own",
                ]}
                flip
                visual={
                  <div className="min-w-0 space-y-8">
                    <NetWorthBanner mockData={NET_WORTH_MOCK} />
                    <TopHoldingsCard mockData={HOLDINGS_MOCK} />
                  </div>
                }
              />
            </div>

            {/* Also included */}
            <FadeIn className="mt-24 sm:mt-32">
              <div className="card-header">Also included</div>
              <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {ALSO_INCLUDED.map((f) => (
                  <div key={f.title}>
                    <div className="text-sm font-medium text-[var(--color-fg)]">{f.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-[var(--color-muted)]">{f.body}</p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ============ How it works ============ */}
        <section className="border-t border-[var(--color-border)] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center">
              <div className="card-header">How it works</div>
              <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Set up once. It runs itself.
              </h2>
            </FadeIn>

            <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10">
              {HOW_IT_WORKS.map((s, i) => (
                <FadeIn key={s.step} delay={i * 0.1}>
                  <div className="text-2xl font-medium tracking-tight text-[var(--color-muted)] tabular-nums">
                    {s.step}
                  </div>
                  <div className="mt-4 text-base font-medium text-[var(--color-fg)]">{s.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{s.body}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Security ============ */}
        <section className="border-t border-[var(--color-border)] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-5 lg:gap-20">
              <FadeIn className="lg:col-span-2">
                <div className="card-header">Security</div>
                <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                  Built like it&apos;s handling your money. Because it is.
                </h2>
                <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">
                  Bank connections run through Plaid, the same infrastructure
                  trusted by thousands of financial apps. Everything sensitive
                  is encrypted, and nothing about the connection can move money.
                </p>
              </FadeIn>
              <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-3">
                {TRUST_ITEMS.map((t, i) => (
                  <FadeIn key={t.title} delay={i * 0.08}>
                    <div className="text-sm font-medium text-[var(--color-fg)]">{t.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-[var(--color-muted)]">{t.body}</p>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ Pricing ============ */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-[var(--color-border)] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center">
              <div className="card-header">Pricing</div>
              <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Simple, honest pricing.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--color-muted)]">
                Start free, upgrade when you want the whole picture. Cancel anytime.
              </p>
            </FadeIn>

            <FadeIn className="mx-auto mt-14 grid max-w-4xl gap-10 lg:grid-cols-2 lg:gap-0">
              <PricingColumn
                price="0"
                tier="Free"
                blurb="Everything you need to get started."
                features={[
                  [true, "Transactions"],
                  [true, "1 connected account"],
                  [true, "Net worth history"],
                  [false, "Budgets"],
                  [false, "Investments"],
                  [false, "Recurring transactions"],
                  [false, "Paper trading"],
                ]}
                cta="Get started"
              />
              <PricingColumn
                price="9"
                tier="Pro"
                blurb="Everything, unlocked."
                highlighted
                features={[
                  [true, "Transactions"],
                  [true, "Unlimited connected accounts"],
                  [true, "Net worth history"],
                  [true, "Budgets"],
                  [true, "Investments"],
                  [true, "Recurring transactions"],
                  [true, "Paper trading"],
                ]}
                cta="Upgrade to Pro"
              />
            </FadeIn>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="scroll-mt-20 border-t border-[var(--color-border)] py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
            <FadeIn className="text-center">
              <div className="card-header">FAQ</div>
              <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Questions, answered.
              </h2>
            </FadeIn>
            <FadeIn className="mt-12 border-t border-[var(--color-border)]">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </FadeIn>
          </div>
        </section>

        {/* ============ Final CTA ============ */}
        <section className="border-t border-[var(--color-border)] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center">
              <h2
                className="text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-5xl"
                style={{ fontFamily: "var(--font-instrument)", letterSpacing: "-0.02em" }}
              >
                Start seeing your money clearly.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--color-muted)]">
                Connect an account and your dashboard fills itself in.
                It takes about a minute.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/auth?mode=signup"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-fg)] px-6 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90"
                >
                  Get started — it&apos;s free
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ============ Footer ============ */}
        <footer className="border-t border-[var(--color-border)] py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <BrandMark size="sm" />
              <nav className="flex items-center gap-6 text-xs text-[var(--color-muted)]">
                <a href="#features" className="transition-colors hover:text-[var(--color-fg)]">Features</a>
                <a href="#pricing" className="transition-colors hover:text-[var(--color-fg)]">Pricing</a>
                <Link href="/docs/terms" className="transition-colors hover:text-[var(--color-fg)]">Terms</Link>
                <Link href="/docs/privacy" className="transition-colors hover:text-[var(--color-fg)]">Privacy</Link>
                <a href={`mailto:${BRAND.supportEmail}`} className="transition-colors hover:text-[var(--color-fg)]">Contact</a>
              </nav>
            </div>
            <p className="text-center text-xs text-[var(--color-muted)] sm:text-left">
              © {new Date().getFullYear()} {BRAND.legalName}
            </p>
          </div>
        </footer>
      </main>
    </PublicRoute>
  );
}
