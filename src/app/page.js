"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowRight,
  FiBarChart2,
  FiLink,
  FiMenu,
  FiPieChart,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import PublicRoute from "../components/PublicRoute";

function LandingNav({ scrolled }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = scrolled
    ? "bg-white/90 border-zinc-200 shadow-sm"
    : "bg-white/70 border-transparent";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur transition-all ${navClass}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-9 w-9 bg-zinc-900"
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
          <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900">ZENTARI</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Features</a>
          <a href="#product" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Product</a>
          <a href="#security" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Security</a>
        </nav>

        <div className="hidden md:flex">
          <Link
            href="/auth"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Sign in
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
          aria-label="Toggle navigation"
        >
          {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-zinc-200 bg-white md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:px-6 lg:px-8">
              <a href="#features" className="text-sm text-zinc-700">Features</a>
              <a href="#product" className="text-sm text-zinc-700">Product</a>
              <a href="#security" className="text-sm text-zinc-700">Security</a>
              <Link href="/auth" className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white">
                Sign in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function DashboardPreview() {
  const bars = [48, 62, 55, 72, 67, 81, 74, 88, 79, 91, 86, 96];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_80px_-32px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        </div>
        <div className="mx-auto rounded-md bg-zinc-100 px-3 py-1 text-[11px] text-zinc-500">zentari.app/dashboard</div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-6">
        <div className="hidden rounded-xl border border-zinc-100 bg-zinc-50 p-3 lg:block">
          {["Overview", "Transactions", "Budgets", "Investments"].map((item, index) => (
            <div
              key={item}
              className={`mb-2 rounded-lg px-3 py-2 text-sm ${index === 0 ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Net worth", "$124,320", "+6.8%"],
              ["Cash flow", "+$2,410", "This month"],
              ["Investments", "$48,900", "+3.2%"],
            ].map(([label, value, meta]) => (
              <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
                <div className="mt-2 text-xl font-semibold text-zinc-900">{value}</div>
                <div className="mt-1 text-xs text-emerald-600">{meta}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900">Spending vs income</div>
                <div className="text-xs text-zinc-500">Last 12 months</div>
              </div>
              <div className="rounded-md bg-white px-3 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200">Updated just now</div>
            </div>
            <div className="flex h-48 items-end gap-2">
              {bars.map((height, index) => (
                <div key={index} className="flex-1 rounded-t-md bg-zinc-300/90" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
        <Icon size={20} />
      </div>
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    const root = document.documentElement;
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-hover");
    root.style.removeProperty("--color-on-accent");

    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <PublicRoute>
      <main className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-white">
        <LandingNav scrolled={scrolled} />

        <section className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top,#ffffff,transparent_55%)] pt-28 pb-20 sm:pt-32 sm:pb-24">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:items-center lg:px-8">
            <div>
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                Personal finance, budgets, and investment tracking in one place
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                A cleaner home for your money.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600">
                Track spending, understand your cash flow, monitor investments, and keep everything organized without the clutter.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth"
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Get started
                  <FiArrowRight className="ml-2" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  See features
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
                <span>No spreadsheet energy</span>
                <span>Fast account sync</span>
                <span>Built for clarity</span>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section id="features" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Features</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Built to feel calm, useful, and obvious.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                The goal is simple: one place to understand your finances without a bunch of noisy UI or overcomplicated workflows.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <FeatureCard icon={FiPieChart} title="Clear dashboards" description="See balances, budgets, and net worth at a glance with simpler visual summaries." />
              <FeatureCard icon={FiLink} title="Connected accounts" description="Bring in your banking and investment data without manually maintaining everything." />
              <FeatureCard icon={FiTarget} title="Better budgeting" description="Keep your monthly plan grounded in what you actually spend." />
              <FeatureCard icon={FiTrendingUp} title="Investment visibility" description="Track portfolio performance alongside the rest of your financial picture." />
            </div>
          </div>
        </section>

        <section id="product" className="border-y border-zinc-200 bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Product</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Less clutter. Better defaults.
              </h2>
            </div>
            <div className="space-y-6 text-sm leading-7 text-zinc-600 sm:text-base">
              <p>
                Zentari is meant to feel more like a clean workspace than a noisy finance app. You should be able to open it, understand what matters, and move on.
              </p>
              <p>
                That means fewer gimmicks, simpler navigation, and a stronger focus on the handful of views you actually care about every week.
              </p>
            </div>
          </div>
        </section>

        <section id="security" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <FiShield size={20} />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900">Security and privacy still matter.</h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                  Account connectivity and sync should feel seamless, but the product should still respect the sensitivity of financial data. Clean design should not come at the cost of trust.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white shadow-sm">
                <div className="text-sm text-zinc-400">Ready to try it?</div>
                <div className="mt-2 text-2xl font-semibold">Start with a simpler setup.</div>
                <Link
                  href="/auth"
                  className="mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicRoute>
  );
}
