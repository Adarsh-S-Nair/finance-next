"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function Tabs({ tabs, initialKey }) {
  const defaultKey = initialKey || (tabs && tabs.length ? tabs[0].key : "");
  const [active, setActive] = useState(defaultKey);

  const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === active), [tabs, active]);

  return (
    <div className="w-full">
      <div className="mb-4 inline-flex items-center rounded-full bg-[var(--color-surface)] p-1">
        <div className="relative">
          <div className="grid grid-cols-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`relative z-10 rounded-full px-3 py-1 text-sm transition-colors hover:cursor-pointer ${
                  active === t.key
                    ? "text-[var(--color-on-accent)]"
                    : "text-[var(--color-fg)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
            className="absolute inset-y-0 z-0 w-1/2 rounded-full bg-[var(--color-accent)]"
            style={{ left: `${(100 / tabs.length) * activeIndex}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-content-bg)]/70 p-6 backdrop-blur-md shadow-soft">
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  );
}


