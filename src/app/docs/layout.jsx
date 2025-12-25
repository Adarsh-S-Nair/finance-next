"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { FiMenu, FiX } from "react-icons/fi";
import { useState } from "react";

const docs = [
  {
    title: "Privacy Policy",
    href: "/docs/privacy"
  },
  {
    title: "Terms of Use",
    href: "/docs/terms"
  },
];

export default function DocsLayout({ children }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <span
                aria-hidden
                className="block h-8 w-8 bg-zinc-900 flex-shrink-0"
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
            <div className="h-5 w-px bg-zinc-200" />
            <span className="text-sm font-medium text-zinc-600">Docs</span>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            {mobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </header>

      <div className="container mx-auto px-6">
        <div className="flex gap-16 py-12">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-28">
              <ul className="space-y-1">
                {docs.map((doc) => {
                  const isActive = pathname === doc.href;
                  return (
                    <li key={doc.href}>
                      <Link
                        href={doc.href}
                        className={`
                          block px-3 py-2 rounded-lg text-[14px] transition-all
                          ${isActive
                            ? "bg-zinc-100 text-zinc-900 font-medium"
                            : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                          }
                        `}
                      >
                        {doc.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Separator */}
              <div className="my-6 border-t border-zinc-100" />

              {/* Contact */}
              <div className="text-[13px] text-zinc-400">
                Questions? <a href="mailto:support@zentari.app" className="text-zinc-600 hover:text-zinc-900 transition-colors">Contact us</a>
              </div>
            </nav>
          </aside>

          {/* Mobile Sidebar */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 lg:hidden"
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                  <span className="font-medium text-zinc-900">Documentation</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-900">
                    <FiX size={20} />
                  </button>
                </div>
                <nav className="p-4">
                  <ul className="space-y-1">
                    {docs.map((doc) => {
                      const isActive = pathname === doc.href;
                      return (
                        <li key={doc.href}>
                          <Link
                            href={doc.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`
                              block px-3 py-2.5 rounded-lg text-sm transition-all
                              ${isActive
                                ? "bg-zinc-100 text-zinc-900 font-medium"
                                : "text-zinc-500 hover:text-zinc-900"
                              }
                            `}
                          >
                            {doc.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </motion.aside>
            </motion.div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8 mt-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-400">
            © {new Date().getFullYear()} Zentari Finance
          </p>
          <div className="flex gap-6">
            {docs.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                {doc.title}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
