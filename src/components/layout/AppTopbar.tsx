"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import AlertsIcon from "../AlertsIcon";
import AddAccountOverlay from "../AddAccountOverlay";
import HouseholdPicker from "../households/HouseholdPicker";

export default function AppTopbar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const showAddButton = pathname !== "/setup";

  return (
    <header id="app-topbar" className="fixed top-0 right-0 z-40 min-h-16 bg-[var(--color-content-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] border-transparent flex flex-col transition-all duration-300 ease-in-out left-0 md:left-20 xl:left-80">
      <div
        className={`mx-auto ${
          pathname === "/dashboard" ? "max-w-[1600px]" : "max-w-[1440px]"
        } px-4 md:px-6 lg:px-10 h-16 w-full flex items-center gap-3 shrink-0 relative`}
      >

        {/* Mobile: page-specific start portal (e.g. search button) */}
        <div id="page-mobile-start-portal" className="md:hidden flex items-center z-10" />

        {/* Mobile + tablet: compact household picker (rail is xl-only) */}
        <div className="xl:hidden flex items-center z-10">
          <HouseholdPicker />
        </div>

        {/* Desktop: page title portal */}
        <div id="page-title-portal" className="hidden md:flex flex-1 items-center min-w-0" />

        <div className="ml-auto flex items-center gap-2">
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
      </div>
      <div id="page-toolbar-portal" className="w-full" />
      {showAddButton && (
        <AddAccountOverlay isOpen={addOpen} onClose={() => setAddOpen(false)} />
      )}
    </header>
  );
}
