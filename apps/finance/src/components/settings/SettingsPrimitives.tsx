"use client";

import type { ReactNode } from "react";

type SectionProps = {
  label: string;
  action?: ReactNode;
  children: ReactNode;
  /** First section in a page omits the top border so it sits flush with the page header */
  first?: boolean;
};

export function SettingsSection({ label, action, children, first = false }: SectionProps) {
  return (
    <section
      className={`py-5 border-b border-[var(--color-border)] ${first ? "" : "border-t"}`}
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type RowProps = {
  label: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  overflowVisible?: boolean;
};

export function SettingsRow({ label, description, control, overflowVisible = false }: RowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3.5 ${
        overflowVisible ? "overflow-visible relative z-10" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{description}</div>
        )}
      </div>
      {control && <div className="flex-shrink-0">{control}</div>}
    </div>
  );
}

type ActionRowProps = {
  label: ReactNode;
  description?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
};

export function SettingsActionRow({
  label,
  description,
  onClick,
  trailing,
  disabled = false,
  danger = false,
}: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full gap-4 py-3.5 -mx-2 px-2 rounded-md text-left transition-colors hover:bg-[var(--color-surface-alt)]/60 disabled:opacity-60 disabled:cursor-default"
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${
            danger ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]"
          }`}
        >
          {label}
        </div>
        {description && (
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{description}</div>
        )}
      </div>
      {trailing && (
        <div className="flex-shrink-0 flex items-center gap-2 text-[var(--color-muted)]">
          {trailing}
        </div>
      )}
    </button>
  );
}
