"use client";

import { useState, useEffect, useRef } from "react";
import { FiBell } from "react-icons/fi"; // Outline icon
import { useUser } from "./UserProvider";
import { motion, AnimatePresence } from "framer-motion";
import { FiAlertCircle, FiChevronRight } from "react-icons/fi";
import Link from "next/link";

export default function AlertsIcon() {
  const { profile } = useUser();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCount = async () => {
      if (!profile?.id) return;

      try {
        const response = await fetch(`/api/plaid/transactions/unknown-count?userId=${profile.id}`);
        if (response.ok) {
          const data = await response.json();
          setCount(data.count || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unknown transaction count:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, [profile?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading) return null;

  // Jiggle animation variants
  const jiggleVariants = {
    hover: {
      rotate: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.5,
        ease: "easeInOut",
      },
    },
    click: {
      rotate: [0, -20, 20, -20, 20, 0],
      scale: [1, 1.2, 1],
      transition: {
        duration: 0.4,
        ease: "easeInOut",
      },
    },
    idle: {
      rotate: 0,
      scale: 1,
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        className="relative p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        whileHover="hover"
        whileTap="click"
        animate={isOpen ? "click" : "idle"}
        variants={jiggleVariants}
        aria-label="Alerts"
      >
        <FiBell className="w-5 h-5" />

        <AnimatePresence>
          {count > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-[var(--color-bg)]"
            >
              <span className="text-[10px] font-bold text-white leading-none">
                {count > 9 ? '9+' : count}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Tooltip (only when closed) */}
      {!isOpen && (
        <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
          <p className="text-xs text-[var(--color-fg)]">Alerts</p>
        </div>
      )}

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-3 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Standardized Header */}
            <div className="px-4 pt-4 pb-2 border-b border-[var(--color-border)]/50">
              <h3 className="text-sm font-medium text-[var(--color-muted)]">Alerts</h3>
            </div>

            <div className="max-h-[300px] overflow-y-auto mt-2">
              {count > 0 ? (
                <div className="p-2">
                  <Link href="/transactions?status=unknown" onClick={() => setIsOpen(false)}>
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-bg)] transition-colors cursor-pointer group">
                      <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                        <FiAlertCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-fg)]">Unknown Transactions</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          You have {count} transaction{count !== 1 ? 's' : ''} that need attention.
                        </p>
                      </div>
                      <FiChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors self-center" />
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-bg)] flex items-center justify-center mx-auto mb-3 text-[var(--color-muted)]">
                    <FiBell className="w-5 h-5 opacity-50" />
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">No new alerts</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
