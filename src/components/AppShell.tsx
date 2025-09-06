"use client";

import Sidebar from "./Sidebar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileSidebar from "./MobileSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const btn = document.getElementById("sidebar-toggle");
    const handler = () => setOpen((v) => !v);
    btn?.addEventListener("click", handler);
    return () => btn?.removeEventListener("click", handler);
  }, []);

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 bg-[var(--color-content-bg)]">
        <AppTopbar />
        <main className="mx-auto max-w-[1400px] px-4">{children}</main>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="drawer"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 44, mass: 0.7 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[var(--color-bg)] shadow-lg lg:hidden overflow-y-auto"
            >
              <MobileSidebar onNavigate={() => setOpen(false)} />
            </motion.div>
            <motion.button
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


