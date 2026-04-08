"use client";

import AlertsIcon from "../AlertsIcon";
import { motion } from "framer-motion";

export default function AppTopbar() {
  return (
    <header id="app-topbar" className="fixed top-0 right-0 z-40 min-h-16 bg-[var(--color-content-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] border-transparent flex flex-col transition-all duration-300 ease-in-out left-0 md:left-20 xl:left-72">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 h-16 w-full flex items-center gap-3 shrink-0 relative">

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0 lg:flex-1 flex items-center gap-3 md:hidden">
          <motion.div
            className="h-8 w-8 bg-[var(--color-fg)]"
            style={{
              maskImage: 'url(/logo.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/logo.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center'
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          />
          <div className="hidden sm:flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>
              ZERVO
            </h1>
            {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
              <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
                TEST
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AlertsIcon />
        </div>
      </div>
      <div id="page-toolbar-portal" className="w-full" />
    </header>
  );
}


