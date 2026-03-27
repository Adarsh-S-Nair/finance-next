"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowRight, FiLink, FiMenu, FiShield, FiTarget, FiTrendingUp, FiX } from "react-icons/fi";
import PublicRoute from "../components/PublicRoute";

function LandingNav({ menuOpen, setMenuOpen }) {
  return (
    <header>
      <div className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-8 w-8 bg-zinc-900"
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
            className="text-xl font-medium tracking-[0.18em] text-zinc-900"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            ZENTARI
          </span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === "mock" && (
            <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400 border border-zinc-200 leading-none">
              TEST
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm tracking-[0.08em] uppercase text-zinc-400 transition-colors hover:text-zinc-900"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Features
          </a>
          <a
            href="#product"
            className="text-sm tracking-[0.08em] uppercase text-zinc-400 transition-colors hover:text-zinc-900"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Product
          </a>
          <a
            href="#security"
            className="text-sm tracking-[0.08em] uppercase text-zinc-400 transition-colors hover:text-zinc-900"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Security
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex">
          <Link
            href="/auth"
            className="border border-zinc-300 text-zinc-500 hover:bg-zinc-900 hover:text-white uppercase tracking-[0.08em] text-sm rounded-md px-5 py-2.5 transition-all cursor-pointer"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Sign In
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
          aria-label="Toggle navigation"
        >
          {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-zinc-200 bg-white/95 backdrop-blur-sm md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-8 py-4">
              <a href="#features" className="text-sm tracking-[0.08em] uppercase text-zinc-600" style={{ fontFamily: "var(--font-outfit)" }}>
                Features
              </a>
              <a href="#product" className="text-sm tracking-[0.08em] uppercase text-zinc-600" style={{ fontFamily: "var(--font-outfit)" }}>
                Product
              </a>
              <a href="#security" className="text-sm tracking-[0.08em] uppercase text-zinc-600" style={{ fontFamily: "var(--font-outfit)" }}>
                Security
              </a>
              <Link
                href="/auth"
                className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white"
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
    <div className="grid gap-3 border-t border-zinc-200 py-6 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        <Icon size={18} />
      </div>
      <div>
        <h3
          className="text-base font-semibold text-zinc-900"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          {title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
      </div>
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
  }, []);

  return (
    <PublicRoute>
      <style>{`
        @keyframes meshShift {
          0% {
            background-position: 0% 0%, 100% 100%, 50% 0%;
          }
          33% {
            background-position: 30% 60%, 70% 40%, 80% 50%;
          }
          66% {
            background-position: 80% 20%, 20% 80%, 10% 70%;
          }
          100% {
            background-position: 0% 0%, 100% 100%, 50% 0%;
          }
        }

        .lp-mesh-bg {
          background-color: #ffffff;
          background-image:
            radial-gradient(ellipse 80% 60% at 20% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse 70% 70% at 80% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 60% 10%, rgba(14, 165, 233, 0.04) 0%, transparent 55%);
          background-size: 120% 120%, 120% 120%, 120% 120%;
          animation: meshShift 20s ease-in-out infinite;
        }

        .lp-dot-overlay {
          background-image: radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .lp-heading-gradient {
          background: linear-gradient(180deg, hsl(220 60% 12%) 0%, hsl(210 70% 45%) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <main className="min-h-screen text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {/* Full-viewport hero */}
        <section className="lp-mesh-bg relative flex h-screen flex-col overflow-hidden">
          {/* Dot grid overlay */}
          <div className="lp-dot-overlay pointer-events-none absolute inset-0 opacity-60" />

          {/* Navbar (not fixed — scrolls with hero) */}
          <div className="relative z-10">
            <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
          </div>

          {/* Hero content */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            {/* Badge */}
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-medium tracking-[0.1em] uppercase text-zinc-500">
              Personal finance, reimagined
            </div>

            {/* H1 */}
            <h1
              className="lp-heading-gradient mt-6 text-5xl font-medium leading-[1.1] max-w-4xl md:text-6xl lg:text-7xl"
              style={{ letterSpacing: "-0.04em", fontFamily: "var(--font-outfit)" }}
            >
              A clearer view of your{" "}
              <br className="hidden md:block" />
              money
            </h1>

            {/* Subheading */}
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-zinc-500 md:text-xl">
              Track spending, understand cash flow, and plan ahead — all in one calm, focused workspace.
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-8 py-3.5 text-sm font-medium uppercase tracking-[0.05em] text-white transition-colors hover:bg-zinc-800 cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Get Started
                <FiArrowRight className="ml-2" size={15} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-8 py-3.5 text-sm font-medium uppercase tracking-[0.05em] text-zinc-600 transition-colors hover:bg-zinc-100 cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                See Features
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-400">
              <span>Bank-level encryption</span>
              <span className="hidden sm:block text-zinc-300">•</span>
              <span>Instant account sync</span>
              <span className="hidden sm:block text-zinc-300">•</span>
              <span>No ads, ever</span>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p
                className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Features
              </p>
              <h2
                className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Built to feel calm, useful, and obvious.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                One place to understand your finances without noisy UI or overcomplicated workflows.
              </p>
            </div>

            <div className="mt-8 border-b border-zinc-200">
              <FeatureRow
                icon={FiLink}
                title="Connected accounts"
                description="Bring in banking and investment data without manually maintaining everything."
              />
              <FeatureRow
                icon={FiTarget}
                title="Better budgeting"
                description="Keep your monthly plan grounded in what you actually spend."
              />
              <FeatureRow
                icon={FiTrendingUp}
                title="Investment visibility"
                description="Track portfolio performance alongside the rest of your financial picture."
              />
            </div>
          </div>
        </section>

        {/* Product section */}
        <section id="product" className="scroll-mt-20 border-y border-zinc-200 bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p
                className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Product
              </p>
              <h2
                className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
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

        {/* Security section */}
        <section id="security" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <FiShield size={18} />
                </div>
                <h3
                  className="mt-5 text-2xl font-semibold text-zinc-900"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  Security and privacy still matter.
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                  Account connectivity should feel seamless, but the product still needs to respect the sensitivity of financial data. Clean design should not come at the cost of trust.
                </p>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ready to try it?</div>
                <Link
                  href="/auth"
                  className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                  style={{ fontFamily: "var(--font-outfit)" }}
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
