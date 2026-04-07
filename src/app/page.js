"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiLink, FiMenu, FiShield, FiTarget, FiTrendingUp, FiX } from "react-icons/fi";
import dynamic from "next/dynamic";
import PublicRoute from "../components/PublicRoute";

const HeroBlob = dynamic(() => import("../components/HeroBlob"), { ssr: false });

export function LandingNav({ menuOpen, setMenuOpen, showLinks = true, bgClass }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerBg = bgClass ?? (scrolled ? "bg-zinc-950/95 backdrop-blur-md border-b border-white/5" : "bg-transparent");

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${headerBg}`}>
      <div className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-10 w-10 bg-white"
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
            className="text-sm font-medium tracking-[0.18em] text-white"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            ZERVO
          </span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === "mock" && (
            <span className="text-[9px] font-bold tracking-wide uppercase text-zinc-500 leading-none">
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
                className="text-sm font-medium tracking-wide text-zinc-400 transition-colors hover:text-white"
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
              className="bg-white/10 text-white text-sm font-medium rounded-md px-5 py-2.5 transition-all duration-150 hover:bg-white/20 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97] cursor-pointer backdrop-blur-sm border border-white/10"
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
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white md:hidden"
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
            className="border-t border-white/10 bg-zinc-950/95 backdrop-blur-sm md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-8 py-4">
              {["Features", "Product", "Pricing", "Security"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>
                  {item}
                </a>
              ))}
              <Link
                href="/auth"
                className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-white/10 px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-white/20 hover:scale-[1.04] active:scale-[0.97] border border-white/10"
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
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon size={16} />
        <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-outfit)" }}>
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
    // Force light class off so the landing page controls its own palette
    document.documentElement.classList.remove("dark");
    const root = document.documentElement;
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-hover");
    root.style.removeProperty("--color-on-accent");

    // Handle Supabase auth codes that land on the root URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/dashboard`);
    }
  }, []);

  return (
    <PublicRoute>
      <style>{`
        html, body { background: #09090b !important; }
        .lp-heading-gradient {
          background: linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(210 40% 72%) 100%);
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

      <main className="min-h-screen bg-zinc-950 text-white selection:bg-white selection:text-zinc-950">
        <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        {/* Hero */}
        <section className="relative flex h-screen flex-col overflow-hidden">
          {/* 3D animated blob */}
          <HeroBlob />

          <div className="relative z-10 flex flex-1 flex-col items-start justify-center px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto w-full">
            <h1
              className="lp-heading-gradient lp-fade-1 text-2xl font-light leading-[1.2] max-w-2xl uppercase sm:text-3xl md:text-4xl lg:text-5xl"
              style={{ letterSpacing: "0.12em", fontFamily: "var(--font-outfit)" }}
            >
              A clearer view of{" "}
              <br className="hidden md:block" />
              your money
            </h1>

            <p className="lp-fade-2 mt-8 max-w-lg text-lg leading-relaxed text-zinc-400 md:text-xl">
              Track spending, understand cash flow, and plan ahead — all in one calm, focused workspace.
            </p>

            <div className="lp-fade-3 mt-10 flex flex-col items-start gap-4 sm:flex-row">
              <Link
                href="/setup"
                className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3.5 text-sm font-medium text-zinc-900 transition-all duration-150 hover:bg-zinc-100 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97] cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Get Started
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-8 py-3.5 text-sm font-medium text-zinc-300 transition-all duration-150 hover:bg-white/10 hover:scale-[1.04] hover:shadow-md active:scale-[0.97] cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                See Features
              </a>
            </div>

            <div className="lp-fade-4 mt-12 flex flex-wrap items-center gap-6 sm:gap-8 text-sm text-zinc-500">
              <span>Bank-level encryption</span>
              <span className="hidden sm:block text-zinc-600">•</span>
              <span>Instant account sync</span>
              <span className="hidden sm:block text-zinc-600">•</span>
              <span>No ads, ever</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-white/5 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500" style={{ fontFamily: "var(--font-outfit)" }}>
                Features
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Built to feel calm, useful, and obvious.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
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
        <section id="product" className="scroll-mt-20 border-t border-white/5 bg-white/[0.02] py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500" style={{ fontFamily: "var(--font-outfit)" }}>
                Product
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Less clutter. Better defaults.
              </h2>
            </div>
            <div className="space-y-6 text-sm leading-7 text-zinc-400 sm:text-base">
              <p>Zervo should feel more like a clean workspace than a noisy finance app. You should be able to open it, understand what matters, and move on.</p>
              <p>That means fewer gimmicks, simpler navigation, and a stronger focus on the handful of views you actually care about every week.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-white/5 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium tracking-[0.18em] text-zinc-500" style={{ fontFamily: "var(--font-outfit)" }}>
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "var(--font-outfit)" }}>
                Simple, honest pricing.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Start free. Upgrade when you need more.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {/* Free tier */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-outfit)" }}>$0</span>
                  <span className="text-sm text-zinc-500">/mo</span>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-400" style={{ fontFamily: "var(--font-outfit)" }}>Free</p>
                <p className="mt-4 text-sm text-zinc-500">Everything you need to get started.</p>
                <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Transactions</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> 1 connected account</li>
                  <li className="flex items-center gap-2"><FiCheck className="text-emerald-500 shrink-0" size={14} /> Net worth history</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-600 shrink-0" size={14} /> Budgets</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-600 shrink-0" size={14} /> Investments</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-600 shrink-0" size={14} /> Recurring transactions</li>
                  <li className="flex items-center gap-2"><FiX className="text-zinc-600 shrink-0" size={14} /> Paper trading</li>
                </ul>
                <Link
                  href="/setup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all duration-150 hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  Get Started
                </Link>
              </div>

              {/* Pro tier */}
              <div className="relative overflow-hidden rounded-xl border-2 border-emerald-500/50 bg-emerald-500/[0.05] p-8">
                <span className="absolute top-0 right-6 px-3 py-1 rounded-b-lg text-[10px] font-bold uppercase tracking-wide text-white bg-emerald-500">
                  Recommended
                </span>
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500 opacity-[0.08] blur-2xl" />
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-outfit)" }}>$9</span>
                  <span className="text-sm text-zinc-500">/mo</span>
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
        <section id="security" className="scroll-mt-20 border-t border-white/5 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                  <FiShield size={18} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-outfit)" }}>
                  Security and privacy still matter.
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                  Account connectivity should feel seamless, but the product still needs to respect the sensitivity of financial data. Clean design should not come at the cost of trust.
                </p>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ready to try it?</div>
                <Link
                  href="/setup"
                  className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-white px-5 text-sm font-medium text-zinc-900 transition-all duration-150 hover:bg-zinc-100 hover:scale-[1.04] hover:shadow-lg active:scale-[0.97]"
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
