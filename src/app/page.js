"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowRight, FiLink, FiMenu, FiShield, FiTarget, FiTrendingUp, FiX } from "react-icons/fi";
import PublicRoute from "../components/PublicRoute";

function LandingNav({ scrolled }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur transition-all ${scrolled ? "border-zinc-200 bg-white/90 shadow-sm" : "border-transparent bg-white/70"}`}>
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
          {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
            <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
              TEST
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Features</a>
          <a href="#product" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Product</a>
          <a href="#security" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">Security</a>
        </nav>

        <div className="hidden md:flex">
          <Link href="/auth" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
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

function FeatureRow({ icon: Icon, title, description }) {
  return (
    <div className="grid gap-3 border-t border-zinc-200 py-6 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
      </div>
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
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                Personal finance, budgets, and investment tracking in one place
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                A cleaner home for your money.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
                Track spending, understand cash flow, and monitor investments in one calm, focused workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth" className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
                  Get started
                  <FiArrowRight className="ml-2" />
                </Link>
                <a href="#features" className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100">
                  See features
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
                <span>No spreadsheet energy</span>
                <span>Fast account sync</span>
                <span>Built for clarity</span>
              </div>
            </div>
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
                One place to understand your finances without noisy UI or overcomplicated workflows.
              </p>
            </div>

            <div className="mt-8 border-b border-zinc-200">
              <FeatureRow icon={FiLink} title="Connected accounts" description="Bring in banking and investment data without manually maintaining everything." />
              <FeatureRow icon={FiTarget} title="Better budgeting" description="Keep your monthly plan grounded in what you actually spend." />
              <FeatureRow icon={FiTrendingUp} title="Investment visibility" description="Track portfolio performance alongside the rest of your financial picture." />
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
                Zentari should feel more like a clean workspace than a noisy finance app. You should be able to open it, understand what matters, and move on.
              </p>
              <p>
                That means fewer gimmicks, simpler navigation, and a stronger focus on the handful of views you actually care about every week.
              </p>
            </div>
          </div>
        </section>

        <section id="security" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <FiShield size={18} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-zinc-900">Security and privacy still matter.</h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                  Account connectivity should feel seamless, but the product still needs to respect the sensitivity of financial data. Clean design should not come at the cost of trust.
                </p>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ready to try it?</div>
                <Link href="/auth" className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
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
