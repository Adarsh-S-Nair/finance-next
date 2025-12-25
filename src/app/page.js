"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  FiArrowRight,
  FiPieChart,
  FiTrendingUp,
  FiShield,
  FiZap,
  FiTarget,
  FiLink,
  FiBarChart2,
  FiStar,
  FiTwitter,
  FiGithub,
  FiLinkedin,
  FiMenu,
  FiX
} from "react-icons/fi";

// Animated Grid Background
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50/50 to-white" />

      {/* Animated grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Floating orbs */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] right-[15%] w-[500px] h-[500px] bg-gradient-to-br from-zinc-200/40 to-zinc-100/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          y: [0, 15, 0],
          x: [0, -10, 0],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-[30%] left-[5%] w-[400px] h-[400px] bg-gradient-to-tr from-zinc-300/30 to-zinc-200/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          y: [0, -15, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] bg-gradient-to-bl from-zinc-200/30 to-transparent rounded-full blur-3xl"
      />

      {/* Subtle moving lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

// Navigation Component - Matches app's Topbar style
function Navigation({ scrolled }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? "bg-white/80 backdrop-blur-xl border-b border-zinc-100 shadow-sm"
        : "bg-transparent"
        }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-2 h-20">
        {/* Logo - Matches app's Topbar */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <span
            aria-hidden
            className="block h-16 w-16 bg-zinc-900 flex-shrink-0"
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
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium">How It Works</a>
          <a href="#testimonials" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium">Testimonials</a>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth"
            className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Log in / Sign up
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-zinc-600 hover:text-zinc-900"
        >
          {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-b border-zinc-100"
          >
            <div className="container mx-auto px-6 py-4 space-y-4">
              <a href="#features" className="block text-zinc-600 hover:text-zinc-900 font-medium">Features</a>
              <a href="#how-it-works" className="block text-zinc-600 hover:text-zinc-900 font-medium">How It Works</a>
              <a href="#testimonials" className="block text-zinc-600 hover:text-zinc-900 font-medium">Testimonials</a>
              <hr className="border-zinc-200" />
              <Link href="/auth" className="block text-zinc-900 font-medium">Log in / Sign up</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group p-8 rounded-2xl bg-white/80 backdrop-blur-sm border border-zinc-100 shadow-sm hover:shadow-xl hover:border-zinc-200 transition-all duration-300"
    >
      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center mb-6 group-hover:from-zinc-900 group-hover:to-zinc-800 transition-all duration-300">
        <Icon size={26} className="text-zinc-700 group-hover:text-white transition-colors duration-300" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 mb-3">{title}</h3>
      <p className="text-zinc-500 leading-relaxed text-sm">{description}</p>
    </motion.div>
  );
}

// Step Card Component
function StepCard({ number, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="relative text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 text-white text-2xl font-bold mb-6">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 mb-3">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">{description}</p>
    </motion.div>
  );
}

// Testimonial Card Component
function TestimonialCard({ quote, author, role, avatar, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-8 rounded-2xl bg-white/80 backdrop-blur-sm border border-zinc-100 shadow-sm"
    >
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <FiStar key={i} className="text-amber-400 fill-amber-400" size={16} />
        ))}
      </div>
      <p className="text-zinc-600 leading-relaxed mb-6 italic">"{quote}"</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-100 flex items-center justify-center text-lg font-semibold text-zinc-600">
          {avatar}
        </div>
        <div>
          <div className="font-semibold text-zinc-900">{author}</div>
          <div className="text-sm text-zinc-500">{role}</div>
        </div>
      </div>
    </motion.div>
  );
}

// Interactive Dashboard Preview
function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('overview');
  const [hoveredBar, setHoveredBar] = useState(null);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'budget', label: 'Budget' },
    { id: 'investments', label: 'Investments' },
  ];

  const stats = [
    { label: 'Total Balance', value: '$24,850.00', change: '+5.2%', positive: true },
    { label: 'Monthly Spending', value: '$3,420.50', change: '-8.1%', positive: true },
    { label: 'Savings Goal', value: '$15,000.00', change: '+24%', positive: true },
  ];

  const chartBars = [45, 72, 48, 95, 60, 85, 55, 65, 40, 75, 50, 80];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="relative z-10 rounded-2xl bg-zinc-900/5 p-2 ring-1 ring-inset ring-zinc-900/10 lg:rounded-3xl lg:p-4"
    >
      <div className="rounded-xl bg-white shadow-2xl ring-1 ring-zinc-900/5 overflow-hidden">
        {/* Window Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="mx-auto h-7 w-72 rounded-lg bg-zinc-100 flex items-center justify-center text-xs text-zinc-400 font-mono">
            zentari.app/dashboard
          </div>
        </div>

        <div className="flex h-[420px]">
          {/* Sidebar */}
          <div className="hidden md:flex w-52 flex-col border-r border-zinc-100 bg-zinc-50/50 p-4 gap-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === item.id
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 bg-white overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-zinc-900">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h3>
              <div className="flex gap-2">
                <div className="h-9 w-9 rounded-full bg-zinc-100" />
                <div className="h-9 w-28 rounded-lg bg-zinc-100" />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-lg hover:border-zinc-200 transition-all cursor-default"
                >
                  <p className="text-xs text-zinc-500 mb-1 font-medium">{stat.label}</p>
                  <p className="text-lg font-bold text-zinc-900">{stat.value}</p>
                  <span className={`text-xs font-semibold ${stat.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stat.change}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Chart */}
            <div className="flex-1 rounded-xl border border-zinc-100 bg-zinc-50/30 p-4 relative flex items-end justify-between gap-2">
              {chartBars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.6, delay: 0.8 + i * 0.03, ease: "easeOut" }}
                  onHoverStart={() => setHoveredBar(i)}
                  onHoverEnd={() => setHoveredBar(null)}
                  className={`w-full rounded-t-md transition-colors cursor-pointer relative ${hoveredBar === i ? "bg-zinc-800" : "bg-zinc-300"
                    }`}
                >
                  <AnimatePresence>
                    {hoveredBar === i && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-10 font-medium"
                      >
                        ${(h * 42.5).toFixed(0)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        router.replace("/dashboard");
      }
      // Force landing page to light mode
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme.dark', '0');
        localStorage.setItem('theme.accent', 'default');
      } catch { }
      const root = document.documentElement;
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--color-accent-hover');
      root.style.removeProperty('--color-on-accent');
    })();

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [router]);

  const features = [
    {
      icon: FiPieChart,
      title: "Smart Analytics",
      description: "Visualize your spending patterns with beautiful, interactive charts that reveal where your money really goes."
    },
    {
      icon: FiZap,
      title: "Real-time Sync",
      description: "Connect your accounts and watch transactions appear instantly. No more manual tracking or spreadsheet updates."
    },
    {
      icon: FiShield,
      title: "Bank-grade Security",
      description: "Your data is encrypted end-to-end. We use the same security protocols as major financial institutions."
    },
    {
      icon: FiTarget,
      title: "Goal Tracking",
      description: "Set savings goals and track your progress with visual milestones that keep you motivated."
    },
    {
      icon: FiBarChart2,
      title: "Investment Insights",
      description: "Monitor your portfolio performance and get AI-powered insights to optimize your investment strategy."
    },
    {
      icon: FiLink,
      title: "5,000+ Integrations",
      description: "Connect with virtually any bank, credit card, or investment account through our secure Plaid integration."
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Connect Your Accounts",
      description: "Securely link your bank accounts, credit cards, and investments in just a few clicks."
    },
    {
      number: "2",
      title: "Get Instant Insights",
      description: "Our AI analyzes your finances and surfaces actionable insights tailored to your goals."
    },
    {
      number: "3",
      title: "Take Control",
      description: "Make smarter decisions with a complete view of your financial life in one dashboard."
    }
  ];

  const testimonials = [
    {
      quote: "Zentari completely changed how I manage my money. The insights are incredible and the interface is so clean.",
      author: "Sarah Chen",
      role: "Software Engineer",
      avatar: "SC"
    },
    {
      quote: "Finally, a finance app that doesn't feel like a chore to use. I actually look forward to checking my dashboard.",
      author: "Marcus Johnson",
      role: "Small Business Owner",
      avatar: "MJ"
    },
    {
      quote: "The investment tracking feature alone is worth it. I can see my entire portfolio performance at a glance.",
      author: "Emily Rodriguez",
      role: "Product Designer",
      avatar: "ER"
    }
  ];

  return (
    <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white overflow-x-hidden">
      <AnimatedBackground />
      <Navigation scrolled={scrolled} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32">
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-zinc-600 text-sm font-medium mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              AI-powered investment insights
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-zinc-900 mb-8 leading-[1.05]"
            >
              Your finances,
              <br />
              <span className="bg-gradient-to-r from-zinc-900 via-zinc-600 to-zinc-900 bg-clip-text text-transparent">
                beautifully organized.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-2xl text-zinc-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
            >
              The modern way to track spending, manage budgets, and grow your wealth. All in one stunning dashboard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/auth"
                className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:shadow-zinc-900/30"
              >
                Get started free
                <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-zinc-200 text-zinc-900 rounded-xl font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center"
              >
                See how it works
              </a>
            </motion.div>

            {/* Dashboard Preview */}
            <div className="mt-20 lg:mt-28">
              <DashboardPreview />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 lg:py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Everything you need to
              <br />
              <span className="text-zinc-400">master your money</span>
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Powerful features wrapped in a beautiful interface. No complexity, just clarity.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 lg:py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Get started in minutes
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Three simple steps to financial clarity
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <StepCard key={i} {...step} delay={i * 0.15} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 lg:py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              What users are saying
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              See why people love managing their finances with Zentari
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <TestimonialCard key={i} {...testimonial} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto bg-zinc-900 rounded-[2.5rem] p-12 md:p-20 text-center text-white overflow-hidden relative"
          >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#3f3f46,transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#27272a,transparent_50%)]" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Ready to take control
                <br />
                of your finances?
              </h2>
              <p className="text-zinc-400 text-lg md:text-xl mb-10 max-w-xl mx-auto">
                Start your journey to financial clarity today. It only takes a few minutes to get started.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white text-zinc-900 rounded-xl font-medium hover:bg-zinc-100 transition-colors gap-2 group"
                >
                  Get started free
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <p className="text-zinc-500 text-sm mt-6">
                No credit card required · Free for personal use
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-zinc-100 bg-white/80 backdrop-blur-sm relative">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center mb-4">
                <span
                  aria-hidden
                  className="block h-12 w-12 bg-zinc-900 flex-shrink-0"
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
              </Link>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The modern way to manage your personal finances and build wealth.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold text-zinc-900 mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">How It Works</a></li>
                <li><a href="#testimonials" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Testimonials</a></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-zinc-900 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="font-semibold text-zinc-900 mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><Link href="/docs/privacy" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/docs/terms" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Terms of Use</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} Zentari Finance. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <FiTwitter size={20} />
              </a>
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <FiGithub size={20} />
              </a>
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <FiLinkedin size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
