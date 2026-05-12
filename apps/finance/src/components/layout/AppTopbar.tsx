"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import AlertsIcon from "../AlertsIcon";
import AddAccountOverlay from "../AddAccountOverlay";
import MobileNavMenu from "./MobileNavMenu";

export default function AppTopbar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const showAddButton = pathname !== "/setup";

  return (
    <header
      id="app-topbar"
      className="sticky top-[var(--impersonation-banner-h,0px)] z-40 min-h-16 bg-[var(--color-content-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] flex flex-col"
    >
      <div
        className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-10 h-16 w-full flex items-center gap-3 shrink-0 relative"
      >

        {/* Mobile: hamburger menu — fixed-position trigger that morphs into
            an X and floats to the top-right while the drawer is open. */}
        <MobileNavMenu />

        {/* Mobile: page-specific start portal (e.g. search button) */}
        <div id="page-mobile-start-portal" className="md:hidden flex items-center z-10" />

        {/* Desktop: page title portal */}
        <div id="page-title-portal" className="hidden md:flex flex-1 items-center min-w-0" />

        <div className="ml-auto flex items-center gap-2">
          {/* Portal target for page-level topbar tools (household member
              filter, future per-page actions). Renders nothing by default. */}
          <div id="topbar-tools-portal" className="flex items-center" />
          {showAddButton && (
            <motion.button
              type="button"
              onClick={() => setAddOpen(true)}
              className="relative p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9, rotate: 90 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              aria-label="Add account"
            >
              <FiPlus className="w-5 h-5" />
            </motion.button>
          )}
          <AlertsIcon />
        </div>

        {/* Mobile-only portal that takes over the entire topbar row. Pages
            that need a full-width search / toolbar (e.g. transactions)
            portal their chrome here instead of fighting the default
            add/alerts buttons for space. Hidden when empty.

            `pl-14` reserves room for the fixed hamburger toggle
            (top:14 left:16, h-9 w-9 = 36px wide, ends ~52px from the
            left edge). Without it page content lands underneath the
            hamburger and taps go to the menu instead. */}
        <div
          id="page-mobile-topbar-portal"
          className="md:hidden absolute inset-0 z-20 flex items-center gap-2 pl-14 pr-4 bg-[var(--color-content-bg)] empty:hidden"
        />
      </div>
      <div id="page-toolbar-portal" className="w-full" />
      {showAddButton && (
        <AddAccountOverlay isOpen={addOpen} onClose={() => setAddOpen(false)} />
      )}
    </header>
  );
}
