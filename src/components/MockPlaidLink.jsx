"use client";

import { useState, useEffect, useRef } from "react";
import { FiSearch, FiX } from "react-icons/fi";

const INSTITUTIONS = [
  { id: "ins_mock_chase", name: "Chase", primary_color: "#117ACA" },
  { id: "ins_mock_bofa", name: "Bank of America", primary_color: "#E31837" },
  { id: "ins_mock_schwab", name: "Charles Schwab", primary_color: "#00A0DF" },
  { id: "ins_mock_wellsfargo", name: "Wells Fargo", primary_color: "#D71E28" },
];

/**
 * MockPlaidLink
 *
 * A simplified Plaid Link-style institution picker modal for use in mock mode.
 * Shown when NEXT_PUBLIC_PLAID_ENV === "mock" to let testers pick an institution.
 *
 * Props:
 *   onSuccess(token) - called with a mock public token when an institution is selected
 *   onExit()         - called when user cancels / closes the modal
 */
export default function MockPlaidLink({ onSuccess, onExit }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    // Focus search on mount
    searchRef.current?.focus();

    // Prevent body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const filtered = INSTITUTIONS.filter((inst) =>
    inst.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (inst) => {
    const token = `mock-public-${inst.id}`;
    onSuccess(token);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onExit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Select your institution</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Mock mode — no real data</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search institutions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg bg-zinc-100 py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        </div>

        {/* Institution list */}
        <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No institutions found
            </div>
          ) : (
            filtered.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => handleSelect(inst)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-50 active:bg-zinc-100 transition-colors cursor-pointer"
              >
                {/* Colored dot */}
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: inst.primary_color }}
                />
                <span className="text-sm font-medium text-zinc-800">{inst.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100">
          <p className="text-center text-xs text-zinc-400">
            Powered by <span className="font-medium text-zinc-500">Mock Plaid</span> — test mode only
          </p>
        </div>
      </div>
    </div>
  );
}
