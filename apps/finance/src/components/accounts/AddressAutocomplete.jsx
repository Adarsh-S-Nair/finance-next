"use client";

import { useRef, useState, useEffect } from "react";
import FloatingPanel from "../ui/FloatingPanel";

// Photon (https://photon.komoot.io) is a keyless, CORS-enabled geocoder built
// on OpenStreetMap data — good enough for an address typeahead with zero
// signup or billing. Structured so a higher-quality provider (Google Places,
// Mapbox) can drop in behind this same component later.
const PHOTON_URL = "https://photon.komoot.io/api/";

function formatFeature(feature) {
  const p = feature?.properties || {};
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ");
  // For non-address results (a named place) fall back to the name.
  const primary = streetLine || p.name || "";
  const secondary = [p.city || p.county, p.state, p.postcode].filter(Boolean).join(", ");
  const label = [primary, secondary].filter(Boolean).join(", ");
  return { primary, secondary, label };
}

/**
 * Address field with type-ahead suggestions. `onChange` reports the raw text;
 * `onPrimaryChange` reports just the street line of a picked suggestion (used
 * to auto-fill a nickname default).
 *
 * If the user grants location, results are biased toward their position so the
 * nearest matches rank first (Photon's lat/lon proximity bias). Denial just
 * falls back to unbiased results.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onPrimaryChange,
  placeholder = "Address",
  autoFocus = false,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const lastQueryRef = useRef("");
  // Don't re-query right after the user picks a suggestion (which sets value).
  const justPickedRef = useRef(false);
  // Proximity bias — populated once if the user allows geolocation.
  const coordsRef = useRef(null);
  const locAttemptedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Ask for location once, on first interaction, so the prompt is contextual.
  const ensureLocation = () => {
    if (locAttemptedRef.current) return;
    locAttemptedRef.current = true;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      },
      () => {
        // Denied or unavailable — unbiased results are fine.
      },
      { timeout: 5000, maximumAge: 600000 }
    );
  };

  const runSearch = async (q) => {
    lastQueryRef.current = q;
    try {
      const c = coordsRef.current;
      const bias = c ? `&lat=${c.lat}&lon=${c.lon}` : "";
      const res = await fetch(
        `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=5&lang=en${bias}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (lastQueryRef.current !== q) return; // a newer query superseded this one
      const feats = (data.features || [])
        .map(formatFeature)
        .filter((s) => s.label);
      setSuggestions(feats);
      setOpen(feats.length > 0);
    } catch {
      // Network/geocoder hiccups are non-fatal — the field still works as plain text.
    }
  };

  const handleChange = (v) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (!v || v.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(v.trim()), 300);
  };

  const pick = (s) => {
    justPickedRef.current = true;
    onChange(s.label);
    onPrimaryChange?.(s.primary);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className="border-b border-[var(--color-border)] focus-within:border-[var(--color-fg)] transition-colors input-focus-bar"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            ensureLocation();
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full bg-transparent outline-none text-base py-2 text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/60"
        />
      </div>

      <FloatingPanel anchorRef={wrapRef} open={open} onClose={() => setOpen(false)}>
        <div className="py-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              <div className="text-sm text-[var(--color-fg)] truncate">{s.primary}</div>
              {s.secondary && (
                <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                  {s.secondary}
                </div>
              )}
            </button>
          ))}
        </div>
      </FloatingPanel>
    </div>
  );
}
