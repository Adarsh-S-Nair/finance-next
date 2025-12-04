"use client";

import Sidebar from "./Sidebar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileSidebar from "./MobileSidebar";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(false);
  const pathname = usePathname();

  useEffect(() => {
    const btn = document.getElementById("sidebar-toggle");
    const handler = () => setOpen((v) => !v);
    btn?.addEventListener("click", handler);
    return () => btn?.removeEventListener("click", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <div className="lg:ml-60 xl:ml-64 min-h-screen flex flex-col">
        <AppTopbar />
        <main className="flex-1 pt-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
            {children}
          </div>
        </main>
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
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[var(--color-content-bg)] shadow-lg lg:hidden overflow-y-auto"
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


