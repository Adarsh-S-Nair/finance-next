"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { motion } from "framer-motion";
import AlertsIcon from "../AlertsIcon";
import AddAccountOverlay from "../AddAccountOverlay";
import MobileNavMenu from "./MobileNavMenu";
import { useAgentOverlay } from "../agent/AgentOverlayProvider";

export default function AppTopbar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const showAddButton = pathname !== "/setup";
  const { open: openAgent } = useAgentOverlay();
  // Hide the agent summon on the dedicated /agent route — the user is
  // already in the chat there, so the button would be a no-op visual
  // duplicate.
  const showAgentButton =
    pathname !== "/setup" && !pathname.startsWith("/agent");

  // Detect Mac for keyboard-shortcut hint in the tooltip ("⌘K" vs
  // "Ctrl+K"). SSR-safe: starts as false, updates on mount.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
    }
  }, []);
  const shortcutHint = isMac ? "⌘K" : "Ctrl+K";

  return (
    <header
      id="app-topbar"
      className="sticky top-[var(--impersonation-banner-h,0px)] z-40 min-h-16 bg-[var(--color-content-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-content-bg),transparent_6%)] flex flex-col"
    >
      <div
        className={`mx-auto ${
          pathname === "/dashboard" ? "max-w-[1600px]" : "max-w-[1440px]"
        } px-4 md:px-6 lg:px-10 h-16 w-full flex items-center gap-3 shrink-0 relative`}
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
          {/* Agent summon — opens the global overlay. Cmd+K / Ctrl+K
              works as a keyboard shortcut from anywhere in the app. */}
          {showAgentButton && (
            <motion.button
              type="button"
              onClick={openAgent}
              className="relative p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              aria-label={`Open agent (${shortcutHint})`}
              title={`Ask the agent · ${shortcutHint}`}
            >
              <LuSparkles className="w-5 h-5" />
            </motion.button>
          )}
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
            add/alerts buttons for space. Hidden when empty. */}
        <div
          id="page-mobile-topbar-portal"
          className="md:hidden absolute inset-0 z-20 flex items-center gap-2 px-4 bg-[var(--color-content-bg)] empty:hidden"
        />
      </div>
      <div id="page-toolbar-portal" className="w-full" />
      {showAddButton && (
        <AddAccountOverlay isOpen={addOpen} onClose={() => setAddOpen(false)} />
      )}
    </header>
  );
}
