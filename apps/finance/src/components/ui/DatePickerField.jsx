"use client";

import { useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiCalendar } from "react-icons/fi";
import FloatingPanel from "./FloatingPanel";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fmtDisplay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Themed date picker — a borderless underline trigger that opens a calendar
 * popover styled with the app's CSS variables. Emits/accepts an ISO
 * (YYYY-MM-DD) string. The app has no native date picker, so this is the
 * canonical one.
 */
export default function DatePickerField({ value, onChange, placeholder = "Select a date" }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const today = new Date();
  const [viewDate, setViewDate] = useState(selected || today);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const goMonth = (delta) => setViewDate(new Date(viewYear, viewMonth + delta, 1));

  const pick = (date) => {
    onChange(toISO(date));
    setOpen(false);
  };

  return (
    <div>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-fg)] outline-none text-base py-2 text-left input-focus-bar"
      >
        <span className={selected ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]/60"}>
          {selected ? fmtDisplay(selected) : placeholder}
        </span>
        <FiCalendar className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        width={300}
        maxHeight={400}
      >
        <div className="p-3 select-none">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="p-1.5 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Previous month"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-[var(--color-fg)]">
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="p-1.5 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Next month"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-[10px] font-medium text-[var(--color-muted)] py-1">
                {w}
              </div>
            ))}
            {cells.map((date, i) =>
              date ? (
                (() => {
                  const isSelected = selected && sameDay(date, selected);
                  const isToday = sameDay(date, today);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pick(date)}
                      className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                        isSelected
                          ? "bg-[var(--color-fg)] text-[var(--color-bg)] font-medium"
                          : isToday
                            ? "ring-1 ring-inset ring-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]"
                            : "text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })()
              ) : (
                <div key={i} className="h-8 w-8" />
              )
            )}
          </div>

          {selected && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}
