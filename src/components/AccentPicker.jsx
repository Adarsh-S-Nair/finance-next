"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "./UserProvider";

const PRESETS = [
  { key: "default", base: "var(--color-primary)", hover: "var(--color-primary-hover)", on: "var(--color-on-primary)", label: "Default" },
  { key: "violet", base: "#8b5cf6", hover: "#7c3aed", on: "#ffffff", label: "Violet" },
  { key: "blue", base: "#3b82f6", hover: "#2563eb", on: "#ffffff", label: "Blue" },
  { key: "pink", base: "#ec4899", hover: "#db2777", on: "#ffffff", label: "Pink" },
  { key: "orange", base: "#f97316", hover: "#ea580c", on: "#ffffff", label: "Orange" },
  { key: "green", base: "#22c55e", hover: "#16a34a", on: "#ffffff", label: "Green" },
];

function applyAccent(accent) {
  if (!accent) return;
  const root = document.documentElement;
  root.style.setProperty("--color-accent", accent.base);
  root.style.setProperty("--color-accent-hover", accent.hover);
  root.style.setProperty("--color-on-accent", accent.on);
}

export default function AccentPicker({ inline = false }) {
  const { user, profile, setAccentColor } = useUser();
  const [current, setCurrent] = useState("default");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (user) return; // authenticated users use DB-driven accent from provider
    const saved = localStorage.getItem("theme.accent") || "default";
    setCurrent(saved);
    const preset = PRESETS.find((p) => p.key === saved) || PRESETS[0];
    if (saved !== "default") applyAccent(preset);
  }, [user]);

  useEffect(() => {
    if (profile && profile.accent_color === null) {
      setCurrent("default");
      const preset = PRESETS.find((p) => p.key === "default") || PRESETS[0];
      applyAccent(preset);
      localStorage.setItem("theme.accent", "default");
    } else if (profile?.accent_color) {
      const match = PRESETS.find((p) => p.base.toLowerCase() === profile.accent_color.toLowerCase());
      if (match) {
        setCurrent(match.key);
        applyAccent(match);
        localStorage.setItem("theme.accent", match.key);
      } else {
        setCurrent("custom");
        applyAccent({ base: profile.accent_color, hover: profile.accent_color, on: "#ffffff" });
        localStorage.setItem("theme.accent", "custom");
      }
    }
  }, [profile?.accent_color]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const select = (key) => {
    console.log("[AccentPicker] select", key);
    setCurrent(key);
    localStorage.setItem("theme.accent", key);
    const preset = PRESETS.find((p) => p.key === key) || PRESETS[0];
    applyAccent(preset);
    setOpen(false);

    const value = key === "default" ? null : preset.base;
    console.log("[AccentPicker] calling setAccentColor", value);
    setAccentColor(value);
  };

  const active = PRESETS.find((p) => p.key === current) || PRESETS[0];

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-2" aria-label="Accent color">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => select(p.key)}
            className={`h-7 w-7 rounded border cursor-pointer transition-transform duration-150 ${current === p.key ? "ring-2 ring-[var(--color-ring)]" : "border-[var(--color-border)]"} hover:scale-105 hover:shadow`}
            style={{ backgroundColor: p.base }}
            aria-label={p.label}
            aria-pressed={current === p.key}
            title={p.label}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" aria-label="Accent color">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)] focus:outline-none focus-visible:ring-2 cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose accent color"
        title="Choose accent color"
      >
        <span className="h-4 w-4 rounded border border-[var(--color-border)]" style={{ backgroundColor: active.base }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-soft"
        >
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => select(p.key)}
              role="option"
              aria-selected={current === p.key}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)] cursor-pointer"
            >
              <span className="h-4 w-4 rounded border border-[var(--color-border)]" style={{ backgroundColor: p.base }} />
              <span className="flex-1">{p.label}</span>
              {current === p.key && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


