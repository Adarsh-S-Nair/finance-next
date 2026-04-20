"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FiPlus, FiBell } from "react-icons/fi";
import { LuLayoutDashboard, LuWallet, LuArrowRightLeft, LuPiggyBank, LuChartLine, LuChevronsUpDown } from "react-icons/lu";
import PublicRoute from "../components/PublicRoute";
import AuthLoadingScreen from "../components/auth/AuthLoadingScreen";
import { BRAND } from "../config/brand";

// Real dashboard components — rendered with `mockData` so they skip
// network fetches but still use their production render paths.
import NetWorthBanner from "../components/dashboard/NetWorthBanner";
import MonthlyOverviewCard from "../components/dashboard/MonthlyOverviewCard";
import SpendingVsEarningCard from "../components/dashboard/SpendingVsEarningCard";
import TopCategoriesCard from "../components/dashboard/TopCategoriesCard";
import BudgetsCard from "../components/dashboard/BudgetsCard";
import CalendarCard from "../components/dashboard/CalendarCard";
import TopHoldingsCard from "../components/dashboard/TopHoldingsCard";
import InsightsCarousel from "../components/dashboard/InsightsCarousel";


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

// Build a realistic monthly-overview chart for the current month vs. last.
// Generates stepped cumulative spending — many days are flat (no transactions),
// a few days jump up by large amounts (rent, groceries, etc.) — which is how
// real transaction history looks.
function buildMonthlyOverviewMock() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Deterministic PRNG so the chart is identical between renders.
  function makeRand(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // Realistic daily spending pattern:
  // - Day 1: rent-sized charge ($1100-1250)
  // - ~35% of days: no spending
  // - ~40% of days: small ($5-35, coffee/lunch)
  // - ~17% of days: medium ($40-110, groceries/gas)
  // - ~8% of days: large ($120-320, shopping/dinner out)
  function genDaily(seed) {
    const rand = makeRand(seed);
    const out = [];
    for (let i = 0; i < daysInMonth; i++) {
      let amt;
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

  // Build cumulative series
  let curCum = 0;
  let prevCum = 0;
  const rawCur = [];
  const rawPrev = [];
  for (let i = 0; i < daysInMonth; i++) {
    curCum += curDaily[i];
    prevCum += prevDaily[i];
    rawCur.push(curCum);
    rawPrev.push(prevCum);
  }

  // Scale so final values match the target totals shown in the hero numbers.
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

// SpendingVsEarningCard expects externalData.data with earning+spending per month.
// Includes one negative-cashflow month for visual variety.
const CASHFLOW_DATA = {
  data: (() => {
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const now = new Date();
    const months = [];
    const values = [
      { earning: 4820, spending: 3210 },  // +1610
      { earning: 4820, spending: 5380 },  // -560  negative month
      { earning: 4820, spending: 2960 },  // +1860
      { earning: 5200, spending: 3104 },  // +2096
      { earning: 4820, spending: 2847 },  // +1973
      { earning: 6250, spending: 2654 },  // +3596 bonus month
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
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const inDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };

  return {
    recurring: [
      {
        id: "r1",
        merchant_name: "Spotify",
        last_amount: 11.99,
        stream_type: "outflow",
        frequency: "MONTHLY",
        predicted_next_date: inDays(3),
        last_date: inDays(-27),
        category_hex_color: "#1db954",
        category_icon_lib: "Fi",
        category_icon_name: "FiMusic",
      },
      {
        id: "r2",
        merchant_name: "Netflix",
        last_amount: 15.49,
        stream_type: "outflow",
        frequency: "MONTHLY",
        predicted_next_date: inDays(5),
        last_date: inDays(-25),
        category_hex_color: "#e50914",
        category_icon_lib: "Fi",
        category_icon_name: "FiFilm",
      },
      {
        id: "r3",
        merchant_name: "Paycheck",
        last_amount: 2410,
        stream_type: "inflow",
        frequency: "BIWEEKLY",
        predicted_next_date: inDays(9),
        last_date: inDays(-5),
        category_hex_color: "#059669",
        category_icon_lib: "Fi",
        category_icon_name: "FiDollarSign",
      },
      {
        id: "r4",
        merchant_name: "Gym Membership",
        last_amount: 39.99,
        stream_type: "outflow",
        frequency: "MONTHLY",
        predicted_next_date: inDays(11),
        last_date: inDays(-19),
        category_hex_color: "#6366f1",
        category_icon_lib: "Fi",
        category_icon_name: "FiActivity",
      },
      {
        id: "r5",
        merchant_name: "Utilities",
        last_amount: 87.2,
        stream_type: "outflow",
        frequency: "MONTHLY",
        predicted_next_date: inDays(14),
        last_date: inDays(-16),
        category_hex_color: "#f59e0b",
        category_icon_lib: "Fi",
        category_icon_name: "FiZap",
      },
      {
        id: "r6",
        merchant_name: "Internet",
        last_amount: 64.99,
        stream_type: "outflow",
        frequency: "MONTHLY",
        predicted_next_date: inDays(22),
        last_date: inDays(-8),
        category_hex_color: "#0ea5e9",
        category_icon_lib: "Fi",
        category_icon_name: "FiWifi",
      },
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
    VOO: {
      name: "Vanguard S&P 500 ETF",
      assetType: "equity",
      logo: "https://www.google.com/s2/favicons?domain=vanguard.com&sz=128",
    },
    AAPL: {
      name: "Apple Inc.",
      assetType: "equity",
      logo: "https://www.google.com/s2/favicons?domain=apple.com&sz=128",
    },
    MSFT: {
      name: "Microsoft Corp.",
      assetType: "equity",
      logo: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
    },
    NVDA: {
      name: "NVIDIA Corp.",
      assetType: "equity",
      logo: "https://www.google.com/s2/favicons?domain=nvidia.com&sz=128",
    },
    TLT: {
      name: "iShares 20+ Year Treasury",
      assetType: "bond",
      logo: "https://www.google.com/s2/favicons?domain=ishares.com&sz=128",
    },
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
   Landing Nav
   ============================================================ */

export function LandingNav({ showLinks = true }) {
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
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-10 w-10 bg-[var(--color-fg)]"
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
            className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-fg)]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {BRAND.name}
          </span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === "mock" && (
            <span className="card-header ml-1">Test</span>
          )}
        </Link>

        {showLinks && (
          <Link
            href="/auth?mode=signin"
            className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

/* ============================================================
   Mac window chrome
   ============================================================ */

function MacWindow({ children, url = "zervo.app/dashboard" }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18),0_12px_32px_-16px_rgba(0,0,0,0.12)]">
      <div className="relative flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-[11px] text-[var(--color-muted)] tabular-nums">
          {url}
        </div>
      </div>
      <div className="bg-[var(--color-content-bg)]">{children}</div>
    </div>
  );
}

/* ============================================================
   Mock sidebar / topbar
   ============================================================ */

function MockSidebar() {
  const sections = [
    {
      title: "OVERVIEW",
      items: [{ label: "Dashboard", icon: LuLayoutDashboard, active: true }],
    },
    {
      title: "FINANCE",
      items: [
        { label: "Accounts", icon: LuWallet },
        { label: "Transactions", icon: LuArrowRightLeft },
        { label: "Budgets", icon: LuPiggyBank },
      ],
    },
    {
      title: "INVESTING",
      items: [{ label: "Portfolio", icon: LuChartLine }],
    },
  ];

  return (
    <aside className="hidden w-[200px] flex-shrink-0 flex-col self-stretch border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)] lg:flex">
      <div className="flex h-14 flex-shrink-0 items-center px-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="block h-6 w-6 bg-[var(--color-fg)]"
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
            className="text-[11px] font-semibold tracking-[0.24em] text-[var(--color-fg)]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            ZERVO
          </span>
        </div>
      </div>
      <div className="mx-4 border-t border-[var(--color-fg)]/[0.06]" />
      <nav className="flex-1 px-3 pt-5">
        {sections.map((s) => (
          <div key={s.title} className="mb-5">
            <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              {s.title}
            </div>
            {s.items.map((it) => {
              const Icon = it.icon;
              return (
                <div
                  key={it.label}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] ${
                    it.active
                      ? "bg-[var(--color-sidebar-active)] font-medium text-[var(--color-fg)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{it.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex-shrink-0 border-t border-[var(--color-fg)]/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-[var(--color-on-accent)]">
            A
          </div>
          <span className="flex-1 truncate text-[12px] font-medium text-[var(--color-fg)]">Alex Chen</span>
          <LuChevronsUpDown className="h-3 w-3 text-[var(--color-muted)]/50" />
        </div>
      </div>
    </aside>
  );
}

function MockTopbar() {
  return (
    <div className="mb-8 flex items-center justify-between">
      <h2 className="text-xl font-medium tracking-tight text-[var(--color-fg)] sm:text-2xl">
        Good afternoon, Alex
      </h2>
      <div className="flex items-center gap-1 text-[var(--color-muted)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-surface-alt)]">
          <FiPlus size={16} />
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-surface-alt)]">
          <FiBell size={16} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Hero dashboard scene — desktop version
   Mirrors src/config/dashboardLayout.js. Each sidebar card is
   wrapped in a plain div so BudgetsCard's internal `h-full`
   doesn't stretch and swallow the whole column.
   ============================================================ */

function HeroDashboard() {
  return (
    <div className="flex items-stretch">
      <MockSidebar />
      <div className="min-w-0 flex-1 p-5 sm:p-8">
        <MockTopbar />

        <div className="grid min-w-0 gap-8 lg:grid-cols-10 lg:gap-10">
          {/* Main column (lg:col-span-7) */}
          <div className="min-w-0 space-y-10 lg:col-span-7">
            <NetWorthBanner mockData={NET_WORTH_MOCK} />
            <div className="h-[420px]">
              <MonthlyOverviewCard mockData={MONTHLY_OVERVIEW_MOCK} />
            </div>
            <div className="flex min-w-0 flex-col gap-8 lg:h-[440px] lg:flex-row">
              <div className="min-w-0 lg:flex-1">
                <SpendingVsEarningCard data={CASHFLOW_DATA} />
              </div>
              <div className="min-w-0 lg:w-[280px] lg:flex-shrink-0">
                <TopCategoriesCard data={TOP_CATEGORIES_DATA} />
              </div>
            </div>
          </div>

          {/* Sidebar column (lg:col-span-3) */}
          <div className="min-w-0 space-y-10 lg:col-span-3">
            <div><InsightsCarousel mockData={INSIGHTS_MOCK} /></div>
            <div><BudgetsCard budgets={BUDGETS_MOCK} loading={false} /></div>
            <div><CalendarCard mockData={CALENDAR_MOCK} /></div>
            <div><TopHoldingsCard mockData={HOLDINGS_MOCK} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Phone mockup — shown on < lg screens. Narrower content, no
   sidebar, simulates the iOS webapp view of Zervo.
   ============================================================ */

function PhoneFrame({ children }) {
  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[2.25rem] border-[8px] border-zinc-900 bg-[var(--color-content-bg)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35),0_10px_30px_-15px_rgba(0,0,0,0.2)]">
        {/* Status bar with notch */}
        <div className="relative flex h-8 items-center justify-between rounded-t-[1.75rem] bg-[var(--color-content-bg)] px-5 text-[10px] font-semibold text-[var(--color-fg)] tabular-nums">
          <span>9:41</span>
          <span aria-hidden className="absolute left-1/2 top-1 h-4 w-20 -translate-x-1/2 rounded-full bg-zinc-900" />
          <div className="flex items-center gap-1">
            <svg width="13" height="8" viewBox="0 0 15 9" fill="currentColor" aria-hidden>
              <rect x="0" y="6" width="2" height="3" rx="0.5" />
              <rect x="4" y="4" width="2" height="5" rx="0.5" />
              <rect x="8" y="2" width="2" height="7" rx="0.5" />
              <rect x="12" y="0" width="2" height="9" rx="0.5" />
            </svg>
            <svg width="18" height="9" viewBox="0 0 22 10" fill="none" aria-hidden>
              <rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="currentColor" />
              <rect x="2" y="2" width="15" height="6" rx="1" fill="currentColor" />
              <rect x="19.5" y="3" width="2" height="4" rx="0.5" fill="currentColor" />
            </svg>
          </div>
        </div>
        {/* Clipped scroll window — fades out at the bottom */}
        <div
          className="relative h-[480px] overflow-hidden rounded-b-[1.75rem]"
          style={{
            maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
          }}
        >
          <div className="px-3.5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PhoneDashboard() {
  return (
    <div className="min-w-0 space-y-8">
      {/* Mobile topbar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="block h-6 w-6 bg-[var(--color-fg)]"
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
            className="text-[11px] font-semibold tracking-[0.24em] text-[var(--color-fg)]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            ZERVO
          </span>
        </div>
        <div className="flex items-center gap-1 text-[var(--color-muted)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-md">
            <FiBell size={15} />
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-[var(--color-on-accent)]">
            A
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-medium tracking-tight text-[var(--color-fg)]">
          Good afternoon, Alex
        </h2>
      </div>

      {/* Cards — each in a min-w-0 wrapper so SVG charts respect container width */}
      <div className="min-w-0">
        <NetWorthBanner mockData={NET_WORTH_MOCK} />
      </div>

      <div className="h-[340px] min-w-0">
        <MonthlyOverviewCard mockData={MONTHLY_OVERVIEW_MOCK} />
      </div>

      <div className="min-w-0">
        <InsightsCarousel mockData={INSIGHTS_MOCK} />
      </div>

      <div className="min-w-0">
        <BudgetsCard budgets={BUDGETS_MOCK} loading={false} />
      </div>

      <div className="min-w-0">
        <CalendarCard mockData={CALENDAR_MOCK} />
      </div>

      <div className="min-w-0">
        <TopHoldingsCard mockData={HOLDINGS_MOCK} />
      </div>
    </div>
  );
}

/* ============================================================
   Pricing
   ============================================================ */

function PricingColumn({ price, tier, blurb, features, cta, highlighted = false }) {
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
        className={`mt-8 inline-flex h-10 w-full items-center justify-center rounded-md px-5 text-sm font-medium transition-colors ${
          highlighted
            ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
            : "border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function Home() {
  // OAuth sometimes redirects users to `/?code=...` (e.g. if Supabase's
  // Site URL is used as the fallback). In that case, rendering the landing
  // page for even a frame produces a jarring flash between Google and the
  // auth loading screen. The inline script in RootLayout handles this
  // synchronously during HTML parsing; this check is a React-side safety
  // net in case the script is blocked or fails.
  const [isOAuthReturn] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("code");
  });

  useEffect(() => {
    if (!isOAuthReturn) return;
    const code = new URLSearchParams(window.location.search).get("code");
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

        {/* Hero — single full-viewport scene. On lg+ it's fixed to the
            viewport so subsequent sections slide up OVER it as the user
            scrolls, instead of the hero scrolling away. A spacer div
            below reserves the 100vh of flow the fixed hero would have
            taken. */}
        <section className="relative overflow-hidden pt-28 pb-20 sm:pt-32 sm:pb-24 lg:fixed lg:inset-x-0 lg:top-0 lg:z-0 lg:h-screen lg:min-h-[820px] lg:pb-0">
          {/* Left rock — sits BEHIND the dashboard, fades out at its bottom.
              Tighter clamp + bigger left offset so it doesn't crowd the
              dashboard on smaller desktop viewports. */}
          <motion.img
            src="/rock-left.png"
            alt=""
            aria-hidden
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="pointer-events-none absolute -left-[55%] top-0 z-[2] h-[260px] w-auto max-w-none select-none opacity-70 sm:-left-[35%] sm:h-[520px] sm:opacity-80 lg:bottom-0 lg:-left-[3%] lg:top-auto lg:h-[var(--rock-h)] lg:opacity-95"
            style={{
              "--rock-h": "clamp(380px, 60vh, 40vw)",
              maskImage: "linear-gradient(to bottom, black 55%, transparent 92%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 92%)",
            }}
          />

          {/* Right rock — sits OVER the right side of the dashboard (desktop only) */}
          <motion.img
            src="/rock-right.png"
            alt=""
            aria-hidden
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
            className="pointer-events-none absolute bottom-0 -right-[20%] z-20 hidden h-[var(--rock-h)] w-auto max-w-none select-none opacity-95 lg:block"
            style={{ "--rock-h": "clamp(380px, 60vh, 40vw)" }}
          />

          {/* Hero copy — centered */}
          <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
                className="text-4xl font-medium tracking-tight text-[var(--color-fg)] sm:text-5xl lg:text-6xl lg:leading-[1.02]"
                style={{ fontFamily: "var(--font-instrument)", letterSpacing: "-0.02em" }}
              >
                A clearer view of your money.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1], delay: 0.1 }}
                className="mx-auto mt-6 max-w-lg text-base leading-7 text-[var(--color-muted)] sm:text-lg"
              >
                Spending, budgets, and investments — one calm workspace.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1], delay: 0.2 }}
                className="mt-8 flex justify-center"
              >
                <Link
                  href="/auth?mode=signup"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-accent)] px-6 text-sm font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  Get started — it&apos;s free
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Desktop mac window mockup — viewport-relative width so
              the rocks have room to frame it without eating content. */}
          <div
            className="relative z-10 mx-auto mt-14 hidden px-5 sm:mt-16 sm:px-6 lg:block lg:px-8"
            style={{ maxWidth: "min(92vw, 1400px)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 80, rotateX: 12 }}
              animate={{ opacity: 1, y: 0, rotateX: 6 }}
              transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1], delay: 0.2 }}
              style={{
                perspective: 1600,
                transformStyle: "preserve-3d",
                transformOrigin: "center top",
              }}
              className="relative"
            >
              {/* Dashboard extends to the bottom of the hero section —
                  section's overflow-hidden clips anything past the fold. */}
              <div className="relative overflow-hidden rounded-xl">
                <MacWindow>
                  <HeroDashboard />
                </MacWindow>
              </div>
            </motion.div>
          </div>

          {/* Creative pricing anchor — a subtle "pricing" scroll hint
              anchored to the bottom of the viewport, only on desktop.
              Disappears naturally when pricing slides up over the hero. */}
          <motion.a
            href="#pricing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="group absolute bottom-8 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] lg:flex"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <span>Pricing</span>
            <motion.span
              aria-hidden
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-sm"
            >
              ↓
            </motion.span>
          </motion.a>
        </section>

        {/* Spacer — reserves 100vh of flow on lg+ so the fixed hero
            above has "space" to sit in. Subsequent sections naturally
            flow below this, slide up over the hero on scroll. */}
        <div className="hidden lg:block lg:h-screen lg:min-h-[820px]" aria-hidden />

        {/* Pricing — relative + z-10 + opaque bg so it slides UP over
            the fixed hero on scroll. */}
        <section
          id="pricing"
          className="relative z-10 scroll-mt-20 border-t border-[var(--color-border)] bg-[var(--color-content-bg)] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="card-header">Pricing</div>
              <h2 className="mt-5 text-3xl font-medium tracking-tight text-[var(--color-fg)] sm:text-4xl">
                Simple, honest pricing.
              </h2>
            </div>

            <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-0">
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
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-[var(--color-border)] bg-[var(--color-content-bg)] py-8">
          <div className="mx-auto flex max-w-6xl flex-col-reverse items-center justify-between gap-4 px-5 text-xs text-[var(--color-muted)] sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} {BRAND.legalName}</p>
            <nav className="flex items-center gap-6">
              <Link href="/docs/terms" className="transition-colors hover:text-[var(--color-fg)]">Terms</Link>
              <Link href="/docs/privacy" className="transition-colors hover:text-[var(--color-fg)]">Privacy</Link>
              <a href={`mailto:${BRAND.supportEmail}`} className="transition-colors hover:text-[var(--color-fg)]">Contact</a>
            </nav>
          </div>
        </footer>
      </main>
    </PublicRoute>
  );
}
