"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiLink, FiMenu, FiShield, FiTarget, FiTrendingUp, FiX } from "react-icons/fi";
import PublicRoute from "../components/PublicRoute";

export function LandingNav({ menuOpen, setMenuOpen, showLinks = true, bgClass = "bg-white" }) {
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${bgClass}`}>
      <div className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-10 w-10 bg-zinc-900"
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
            className="text-sm font-medium tracking-[0.18em] text-zinc-900"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            ZENTARI
          </span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === "mock" && (
            <span className="text-[9px] font-bold tracking-wide uppercase text-zinc-300 leading-none">
              TEST
            </span>
          )}
        </Link>

        {showLinks && (
          <nav className="hidden items-center gap-8 md:flex">
            {["Features", "Product", "Pricing", "Security"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium tracking-wide text-zinc-400 transition-colors hover:text-zinc-900"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                {item}
              </a>
            ))}
          </nav>
        )}

        {showLinks && (
          <div className="hidden md:flex">
            <Link
              href="/auth"
              className="bg-zinc-900 text-white text-sm font-medium rounded-md px-5 py-2.5 transition-all duration-150 hover:bg-zinc-800 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97] cursor-pointer"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              Sign In
            </Link>
          </div>
        )}

        {showLinks && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showLinks && menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-zinc-100 bg-white/95 backdrop-blur-sm md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-8 py-4">
              {["Features", "Product", "Pricing", "Security"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-zinc-600" style={{ fontFamily: "var(--font-outfit)" }}>
                  {item}
                </a>
              ))}
              <Link
                href="/auth"
                className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 hover:scale-[1.04] active:scale-[0.97]"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Sign In
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
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2 text-zinc-700">
        <Icon size={16} />
        <h3 className="text-sm font-semibold text-zinc-900" style={{ fontFamily: "var(--font-outfit)" }}>
          {title}
        </h3>
      </div>
      <p className="text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    const root = document.documentElement;
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-hover");
    root.style.removeProperty("--color-on-accent");

    // Handle Supabase auth codes that land on the root URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/auth/reset-password`);
    }
  }, []);

  return (
    <PublicRoute>
      <style>{`
        .lp-heading-gradient {
          background: linear-gradient(180deg, hsl(0 0% 9%) 0%, hsl(0 0% 40%) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-fade-1 { animation: fadeInUp 0.8s ease-out 0.1s both; }
        .lp-fade-2 { animation: fadeInUp 0.8s ease-out 0.3s both; }
        .lp-fade-3 { animation: fadeInUp 0.8s ease-out 0.5s both; }
        .lp-fade-4 { animation: fadeInUp 0.8s ease-out 0.7s both; }
      `}</style>

      <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white">
        <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        {/* Hero */}
        <section className="relative flex h-screen flex-col overflow-hidden">
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h1
              className="lp-heading-gradient lp-fade-1 text-3xl font-medium leading-[1.1] max-w-3xl sm:text-4xl md:text-5xl lg:text-6xl"
              style={{ letterSpacing: "-0.04em", fontFamily: "var(--font-outfit)" }}
            >
              A clearer view of{" "}
              <br className="hidden md:block" />
              your money
            </h1>

            <p className="lp-fade-2 mt-8 max-w-xl text-lg leading-relaxed text-zinc-500 md:text-xl">
              Track spending, understand cash flow, and plan ahead — all in one calm, focused workspace.
            </p>

            <div className="lp-fade-3 mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                href="/setup"
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97] cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Get Started
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-8 py-3.5 text-sm font-medium text-zinc-600 transition-all duration-150 hover:bg-zinc-50 hover:scale-[1.04] hover:shadow-md active:scale-[0.97] cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                See Features
              </a>
            </div>

            <div className="lp-fade-4 mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-zinc-400">
              <span>Bank-level encryption</span>
              <span className="hidden sm:block text-zinc-300">•</span>
              <span>Instant account sync</span>
              <span className="hidden sm:block text-zinc-300">•</span>
              <span>No ads, ever</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-zinc-100 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>
                Features
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Built to feel calm, useful, and obvious.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                One place to understand your finances without noisy UI or overcomplicated workflows.
              </p>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              <FeatureRow icon={FiLink} title="Connected accounts" description="Bring in banking and investment data without manually maintaining everything." />
              <FeatureRow icon={FiTarget} title="Better budgeting" description="Keep your monthly plan grounded in what you actually spend." />
              <FeatureRow icon={FiTrendingUp} title="Investment visibility" description="Track portfolio performance alongside the rest of your financial picture." />
            </div>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="scroll-mt-20 border-t border-zinc-100 bg-zinc-50 py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>
                Product
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Less clutter. Better defaults.
              </h2>
            </div>
            <div className="space-y-6 text-sm leading-7 text-zinc-600 sm:text-base">
              <p>Zentari should feel more like a clean workspace than a noisy finance app. You should be able to open it, understand what matters, and move on.</p>
              <p>That means fewer gimmicks, simpler navigation, and a stronger focus on the handful of views you actually care about every week.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-zinc-100 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Simple, honest pricing.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                Start free. Upgrade when you need more.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {/* Free tier */}
              <div className="rounded-xl border border-zinc-200 p-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-zinc-900" style={{ fontFamily: "var(--font-outfit)" }}>$0</span>
                  <span className="text-sm text-zinc-400">/mo</span>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-500" style={{ fontFamily: "var(--font-outfit)" }}>Free</p>
                <p className="mt-4 text-sm text-zinc-500">Everything you need to get started.</p>
                <ul className="mt-6 space-y-3 text-sm text-zinc-600">
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Transactions</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> 1 connected account</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Net worth history</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-300 shrink-0" size={14} /> Budgets</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-300 shrink-0" size={14} /> Investments</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-300 shrink-0" size={14} /> Recurring transactions</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-300 shrink-0" size={14} /> Paper trading</li>
                </ul>
                <Link
                  href="/setup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  Get Started
                </Link>
              </div>

              {/* Pro tier */}
              <div className="relative overflow-hidden rounded-xl border-2 border-emerald-500 bg-zinc-900 p-8">
                <span className="absolute top-0 right-6 px-3 py-1 rounded-b-lg text-[10px] font-bold uppercase tracking-wide text-white bg-emerald-500">
                  Recommended
                </span>
                {/* Subtle emerald glow at top right */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500 opacity-[0.06] blur-2xl" />
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-outfit)" }}>$9</span>
                  <span className="text-sm text-zinc-400">/mo</span>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>Pro</p>
                <p className="mt-4 text-sm text-zinc-400">Everything, unlocked.</p>
                <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Transactions</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> 1 connected account</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Net worth history</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Budgets</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Investments</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Recurring transactions</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Paper trading</li>
                </ul>
                <Link
                  href="/setup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all duration-150 hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 border-t border-zinc-100 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <FiShield size={18} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-zinc-900" style={{ fontFamily: "var(--font-outfit)" }}>
                  Security and privacy still matter.
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                  Account connectivity should feel seamless, but the product still needs to respect the sensitivity of financial data. Clean design should not come at the cost of trust.
                </p>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ready to try it?</div>
                <Link
                  href="/setup"
                  className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97]"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicRoute>
  );
}
