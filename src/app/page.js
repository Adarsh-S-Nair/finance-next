"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { FiArrowRight, FiPieChart, FiTrendingUp, FiShield, FiActivity, FiDollarSign, FiCreditCard } from "react-icons/fi";
import RouteTransition from "../components/RouteTransition";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        router.replace("/dashboard");
      }
      // Force landing page to light mode for a clean, crisp look
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme.dark', '0');
        localStorage.setItem('theme.accent', 'default');
      } catch { }
      // Clear any custom accent overrides
      const root = document.documentElement;
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--color-accent-hover');
      root.style.removeProperty('--color-on-accent');
    })();
  }, [router]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <RouteTransition>
      <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white overflow-hidden">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Dynamic Background */}
          <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
            <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#d4d4d8,transparent)]"></div>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                rotate: [0, 90, 0]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.4, 0.3],
                x: [0, 50, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-100/40 to-teal-100/40 rounded-full blur-3xl"
            />
          </div>

          <div className="container mx-auto px-6 relative">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="max-w-4xl mx-auto text-center"
            >
              {/* Version Pill Removed */}

              <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 mb-6 leading-[1.1]">
                Master your money <br className="hidden md:block" />
                <span className="text-zinc-500">with absolute clarity.</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="text-xl text-zinc-500 mb-10 max-w-2xl mx-auto leading-relaxed">
                Experience a finance tracker that feels less like a spreadsheet and more like a superpower. Beautiful, fast, and intuitive.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-20">
                <Link href="/auth" className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-zinc-900/20">
                  Get started free
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="#features" className="w-full sm:w-auto px-8 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-xl font-medium hover:bg-zinc-50 transition-all flex items-center justify-center">
                  View demo
                </Link>
              </motion.div>

              {/* Interactive Mock Dashboard */}
              <motion.div
                variants={itemVariants}
                className="mt-24 relative z-10 rounded-xl bg-zinc-900/5 p-2 ring-1 ring-inset ring-zinc-900/10 lg:rounded-2xl lg:p-4"
              >
                <div className="rounded-md bg-white shadow-2xl ring-1 ring-zinc-900/10 overflow-hidden text-left">
                  {/* Window Controls */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400/80"></div>
                      <div className="h-3 w-3 rounded-full bg-amber-400/80"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-400/80"></div>
                    </div>
                    <div className="mx-auto h-6 w-64 rounded-md bg-zinc-100/50 flex items-center justify-center text-[10px] text-zinc-400 font-mono">
                      zentari.app/dashboard
                    </div>
                  </div>

                  <div className="flex h-[400px]">
                    {/* Interactive Sidebar */}
                    <div className="hidden md:flex w-48 flex-col border-r border-zinc-100 bg-zinc-50/30 p-4 gap-1">
                      {[
                        { id: 'overview', icon: FiActivity, label: 'Overview' },
                        { id: 'transactions', icon: FiCreditCard, label: 'Transactions' },
                        { id: 'budget', icon: FiPieChart, label: 'Budget' },
                        { id: 'investments', icon: FiTrendingUp, label: 'Investments' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`flex items - center gap - 3 px - 3 py - 2 rounded - lg text - sm font - medium transition - all ${activeTab === item.id
                              ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                            } `}
                        >
                          <item.icon size={16} />
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Interactive Content Area */}
                    <div className="flex-1 p-6 bg-white overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-zinc-900">
                          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                        </h3>
                        <div className="flex gap-2">
                          <div className="h-8 w-8 rounded-full bg-zinc-100"></div>
                          <div className="h-8 w-24 rounded-md bg-zinc-100"></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                          { label: 'Total Balance', value: '$12,450.00', change: '+2.5%' },
                          { label: 'Monthly Spending', value: '$3,200.50', change: '-4.1%' },
                          { label: 'Savings Goal', value: '$8,000.00', change: '+12%' },
                        ].map((stat, i) => (
                          <div key={i} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/30 hover:bg-white hover:shadow-md transition-all cursor-default">
                            <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                            <p className="text-lg font-bold text-zinc-900">{stat.value}</p>
                            <span className={`text - xs font - medium ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'} `}>
                              {stat.change}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Interactive Chart */}
                      <div className="flex-1 rounded-xl border border-zinc-100 bg-zinc-50/30 p-4 relative flex items-end justify-between gap-2">
                        {[45, 72, 48, 95, 60, 85, 55, 65, 40, 75, 50, 80].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}% ` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            onHoverStart={() => setHoveredBar(i)}
                            onHoverEnd={() => setHoveredBar(null)}
                            className={`w - full rounded - t - sm transition - colors cursor - pointer relative group ${hoveredBar === i ? "bg-zinc-800" : "bg-zinc-200"
                              } `}
                          >
                            {hoveredBar === i && (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                ${(h * 42.5).toFixed(2)}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-zinc-50/50">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need</h2>
              <p className="text-zinc-500 max-w-xl mx-auto">Powerful features wrapped in a stunning interface.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6 text-zinc-900">
                  <FiPieChart size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Analytics</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Visualize your spending habits with beautiful, interactive charts that help you understand where your money goes.
                </p>
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6 text-zinc-900">
                  <FiTrendingUp size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-time Tracking</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Connect your accounts and see transactions appear instantly. Stay on top of your finances without the manual work.
                </p>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6 text-zinc-900">
                  <FiShield size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Bank-grade Security</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Your data is encrypted and secure. We use industry-standard protocols to ensure your financial information stays private.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-4xl mx-auto bg-zinc-900 rounded-[2.5rem] p-12 md:p-20 text-center text-white overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,#3f3f46,transparent)] opacity-50"></div>

              <h2 className="text-3xl md:text-5xl font-bold mb-6 relative z-10">Ready to take control?</h2>
              <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto relative z-10">
                Join thousands of users who are already managing their finances smarter, faster, and better.
              </p>
              <Link href="/auth" className="inline-flex items-center justify-center px-8 py-4 bg-white text-zinc-900 rounded-xl font-medium hover:bg-zinc-100 transition-colors relative z-10">
                Start your free trial
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-zinc-100 bg-white">
          <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-zinc-900 rounded-md"></div>
              <span className="font-bold text-lg tracking-tight">Zentari</span>
            </div>
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} Zentari Finance. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">Twitter</a>
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">GitHub</a>
              <a href="#" className="text-zinc-400 hover:text-zinc-900 transition-colors">Discord</a>
            </div>
          </div>
        </footer>
      </main>
    </RouteTransition>
  );
}
