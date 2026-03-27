"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowRight, FiLink, FiMenu, FiShield, FiTarget, FiTrendingUp, FiX } from "react-icons/fi";
import PublicRoute from "../components/PublicRoute";

/* ─── Star field + vortex canvas ─── */
function SpaceCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let stars = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 5000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.3,
          alpha: Math.random() * 0.6 + 0.1,
          drift: (Math.random() - 0.5) * 0.12,
          twinkleSpeed: Math.random() * 0.008 + 0.002,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    };

    const drawVortex = (t) => {
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.38;
      const maxR = Math.min(canvas.width, canvas.height) * 0.38;
      const rings = 6;
      const particlesPerRing = 80;
      const rotation = t * 0.0002;

      for (let ring = 0; ring < rings; ring++) {
        const ringR = maxR * ((ring + 1) / rings);
        const speed = (rings - ring) * 0.4; // inner rings spin faster
        const ringAlpha = 0.03 + (ring / rings) * 0.06;
        const hue = 210 + ring * 8;

        for (let p = 0; p < particlesPerRing; p++) {
          const angle = (p / particlesPerRing) * Math.PI * 2 + rotation * speed + ring * 0.5;
          // Slight ellipse (flatten vertically for depth)
          const px = cx + Math.cos(angle) * ringR;
          const py = cy + Math.sin(angle) * ringR * 0.35;
          const size = 1 + (ring / rings) * 1.5;
          const flicker = Math.sin(t * 0.003 + p + ring) * 0.3 + 0.7;

          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${ringAlpha * flicker})`;
          ctx.fill();
        }
      }

      // Core glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.3);
      grd.addColorStop(0, "rgba(59,130,246,0.12)");
      grd.addColorStop(0.5, "rgba(59,130,246,0.04)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(cx - maxR * 0.3, cy - maxR * 0.3, maxR * 0.6, maxR * 0.6);
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw vortex first (behind stars)
      drawVortex(t);

      // Stars
      for (const s of stars) {
        const flicker = Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * flicker})`;
        ctx.fill();
        s.y += s.drift;
        if (s.y < -2) s.y = canvas.height + 2;
        if (s.y > canvas.height + 2) s.y = -2;
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ─── Nav ─── */
function LandingNav({ menuOpen, setMenuOpen }) {
  return (
    <header>
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
            ZENTARI
          </span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === "mock" && (
            <span className="text-[9px] font-bold tracking-wide uppercase text-white/30 leading-none">
              TEST
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {["Features", "Product", "Security"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm tracking-wide text-white/40 transition-colors hover:text-white"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex">
          <Link
            href="/auth"
            className="border border-white/20 text-white/60 hover:bg-white hover:text-zinc-900 text-sm rounded-md px-5 py-2.5 transition-all cursor-pointer"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Sign In
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white md:hidden"
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
            className="border-t border-white/10 bg-black/80 backdrop-blur-sm md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-8 py-4">
              {["Features", "Product", "Security"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-white/60" style={{ fontFamily: "var(--font-outfit)" }}>
                  {item}
                </a>
              ))}
              <Link
                href="/auth"
                className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-zinc-900"
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

/* ─── Feature row ─── */
function FeatureRow({ icon: Icon, title, description }) {
  return (
    <div className="grid gap-3 border-t border-zinc-200 py-6 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-900" style={{ fontFamily: "var(--font-outfit)" }}>
          {title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
      </div>
    </div>
  );
}

/* ─── Page ─── */
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
        @keyframes nebulaShift {
          0%   { background-position: 0% 50%, 100% 50%, 50% 100%; }
          50%  { background-position: 60% 30%, 40% 70%, 80% 20%; }
          100% { background-position: 0% 50%, 100% 50%, 50% 100%; }
        }
        .lp-space-bg {
          background-color: #06080d;
          background-image:
            radial-gradient(ellipse 80% 60% at 30% 40%, rgba(59,130,246,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 70% 60%, rgba(139,92,246,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 50% 80%, rgba(14,165,233,0.05) 0%, transparent 50%);
          background-size: 150% 150%, 150% 150%, 150% 150%;
          animation: nebulaShift 25s ease-in-out infinite;
        }
        .lp-heading-glow {
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(148,163,184,0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-fade-1 { animation: fadeInUp 0.8s ease-out 0.1s both; }
        .lp-fade-2 { animation: fadeInUp 0.8s ease-out 0.3s both; }
        .lp-fade-3 { animation: fadeInUp 0.8s ease-out 0.5s both; }
        .lp-fade-4 { animation: fadeInUp 0.8s ease-out 0.7s both; }

        /* Dark scrollbar — applied to html/body for the landing page */
        html:has(.lp-space-page) { scrollbar-color: rgba(255,255,255,0.1) #06080d; scrollbar-width: thin; }
        html:has(.lp-space-page)::-webkit-scrollbar { width: 6px; }
        html:has(.lp-space-page)::-webkit-scrollbar-track { background: #06080d; }
        html:has(.lp-space-page)::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        html:has(.lp-space-page)::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <main className="lp-space-page min-h-screen selection:bg-white selection:text-zinc-900">
        {/* ─── Hero ─── */}
        <section className="lp-space-bg relative flex h-screen flex-col overflow-hidden">
          <SpaceCanvas />

          {/* Subtle vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]" />

          <div className="relative z-10">
            <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
          </div>

          {/* Centered hero content */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h1
              className="lp-heading-glow lp-fade-1 text-3xl font-medium leading-[1.1] max-w-3xl sm:text-4xl md:text-5xl lg:text-6xl"
              style={{ letterSpacing: "-0.04em", fontFamily: "var(--font-outfit)" }}
            >
              A clearer view of{" "}
              <br className="hidden md:block" />
              your money
            </h1>

            <p className="lp-fade-2 mt-8 max-w-xl text-lg leading-relaxed text-white/40 md:text-xl">
              Track spending, understand cash flow, and plan ahead — all in one calm, focused workspace.
            </p>

            <div className="lp-fade-3 mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3.5 text-sm font-medium text-zinc-900 transition-all hover:bg-white/90 cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Get Started
                <FiArrowRight className="ml-2" size={15} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-8 py-3.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white cursor-pointer"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                See Features
              </a>
            </div>

            <div className="lp-fade-4 mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-white/25">
              <span>Bank-level encryption</span>
              <span className="hidden sm:block text-white/15">•</span>
              <span>Instant account sync</span>
              <span className="hidden sm:block text-white/15">•</span>
              <span>No ads, ever</span>
            </div>
          </div>

          {/* Bottom fade into white sections — very gradual */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 z-20"
            style={{ background: "linear-gradient(to top, white 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.2) 60%, transparent 100%)" }}
          />
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24 bg-white">
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

            <div className="mt-8 border-b border-zinc-200">
              <FeatureRow icon={FiLink} title="Connected accounts" description="Bring in banking and investment data without manually maintaining everything." />
              <FeatureRow icon={FiTarget} title="Better budgeting" description="Keep your monthly plan grounded in what you actually spend." />
              <FeatureRow icon={FiTrendingUp} title="Investment visibility" description="Track portfolio performance alongside the rest of your financial picture." />
            </div>
          </div>
        </section>

        {/* ─── Product ─── */}
        <section id="product" className="scroll-mt-20 border-y border-zinc-200 bg-zinc-50 py-20 sm:py-24">
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

        {/* ─── Security ─── */}
        <section id="security" className="scroll-mt-20 py-20 sm:py-24 bg-white">
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
