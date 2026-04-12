"use client";

import { useState, useEffect, useRef } from "react";
import { FiBell } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";

type NotificationRowProps = {
  title: string;
  description: string;
  href: string;
  onClick?: () => void;
};

const NotificationRow = ({ title, description, href, onClick }: NotificationRowProps) => (
  <Link href={href} onClick={onClick}>
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface-alt)]/60 transition-colors">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-medium text-[var(--color-fg)] truncate">{title}</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{description}</p>
      </div>
      <span className="text-[var(--color-muted)] text-base leading-none flex-shrink-0">&#8250;</span>
    </div>
  </Link>
);

export default function AlertsIcon() {
  const { profile } = useUser();
  const [counts, setCounts] = useState({ count: 0, unknownAccountCount: 0, unmatchedTransferCount: 0 });
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCount = async () => {
      if (!profile?.id) return;

      try {
        const response = await fetch(`/api/plaid/transactions/unknown-count`);
        if (response.ok) {
          const data = await response.json();
          setCounts(data);
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
  const jiggleVariants: Variants = {
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
        className="relative p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        whileHover="hover"
        whileTap="click"
        animate={isOpen ? "click" : "idle"}
        variants={jiggleVariants}
        aria-label="Notifications"
      >
        <FiBell className="w-5 h-5" />

        <AnimatePresence>
          {counts.count > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-fg)] rounded-full border-2 border-[var(--color-content-bg)]"
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-80 bg-[var(--color-content-bg)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-fg)]">Notifications</h3>
            </div>

            {/* Body */}
            <div className="max-h-[360px] overflow-y-auto">
              {counts.count > 0 ? (
                <div>
                  {counts.unmatchedTransferCount > 0 && (
                    <NotificationRow
                      href="/transactions?status=attention"
                      onClick={() => setIsOpen(false)}
                      title="Unmatched transfers"
                      description={`${counts.unmatchedTransferCount} transfer${counts.unmatchedTransferCount !== 1 ? 's' : ''} need review`}
                    />
                  )}
                  {counts.unknownAccountCount > 0 && (
                    <NotificationRow
                      href="/transactions?status=attention"
                      onClick={() => setIsOpen(false)}
                      title="Unknown accounts"
                      description={`${counts.unknownAccountCount} transaction${counts.unknownAccountCount !== 1 ? 's' : ''} from unknown accounts`}
                    />
                  )}
                </div>
              ) : (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[var(--color-muted)]">You&apos;re all caught up</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
