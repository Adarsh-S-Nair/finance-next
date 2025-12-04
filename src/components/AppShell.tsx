"use client";

import Sidebar from "./Sidebar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNavBar from "./MobileNavBar";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsSidebarCollapsed(false);
        setIsTablet(false);
      } else if (window.innerWidth >= 768) {
        setIsTablet(true);
        // Always collapse when entering tablet mode or resizing within it to ensure consistent state
        setIsSidebarCollapsed(true);
      } else {
        setIsTablet(false);
      }
    };

    // Initial check
    handleResize();
    // If we want tablet to start collapsed:
    if (window.innerWidth >= 768 && window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        showToggle={isTablet}
      />
      <div
        className="min-h-screen flex flex-col transition-all duration-300 ease-in-out md:ml-20 xl:ml-64"
      >
        <AppTopbar isSidebarCollapsed={isSidebarCollapsed} />
        <main className="flex-1 pt-16 pb-24 md:pb-0">
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {/* Tablet Backdrop */}
        {isTablet && !isSidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}
      </AnimatePresence>

      <MobileNavBar />
    </div>
  );
}


