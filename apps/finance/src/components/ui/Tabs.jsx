"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function Tabs({ tabs, initialKey, variant = "default" }) {
  const defaultKey = initialKey || (tabs && tabs.length ? tabs[0].key : "");
  const [active, setActive] = useState(defaultKey);

  const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === active), [tabs, active]);
  const isZinc = variant === "zinc";

  return (
    <div className="w-full">
      <div className={`mb-4 inline-flex items-center rounded-md p-1 ${isZinc ? "bg-zinc-100" : "bg-[var(--color-surface)]"}`}>
        <div className="relative min-w-[220px]">
          <div className="grid grid-cols-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`relative z-10 rounded-md px-4 py-2 text-sm font-medium transition-colors hover:cursor-pointer ${
                  active === t.key
                    ? isZinc
                      ? "text-white"
                      : "text-[var(--color-on-accent)]"
                    : isZinc
                      ? "text-zinc-600 hover:text-zinc-900"
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
            className={`absolute inset-y-0 z-0 w-1/2 rounded-md ${isZinc ? "bg-zinc-900" : "bg-[var(--color-accent)]"}`}
            style={{ left: `${(100 / tabs.length) * activeIndex}%` }}
          />
        </div>
      </div>

      <div className={`${isZinc ? "min-h-[360px]" : ""}`}>
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  );
}
