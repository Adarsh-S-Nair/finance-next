"use client";

import clsx from "clsx";
import type { HouseholdMemberPreview } from "../providers/HouseholdsProvider";

type Props = {
  members: HouseholdMemberPreview[];
  totalMembers: number;
  size?: number;
  /**
   * Used when the household has no preview members available yet (e.g.
   * the data is still loading). Falls back to a single colored disc
   * with household initials so the rail never renders blank slots.
   */
  fallbackName?: string;
  fallbackColor?: string;
  className?: string;
};

function memberInitials(m: HouseholdMemberPreview): string {
  const f = (m.first_name ?? "").trim();
  const l = (m.last_name ?? "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "?";
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({
  size,
  member,
  border,
}: {
  size: number;
  member: HouseholdMemberPreview;
  border: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderWidth: border,
        borderStyle: border ? "solid" : undefined,
        borderColor: border ? "var(--color-content-bg)" : undefined,
      }}
      className="rounded-full overflow-hidden bg-[var(--color-accent)] text-[var(--color-on-accent,white)] flex items-center justify-center box-border"
    >
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatar_url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span style={{ fontSize: Math.round((size - border * 2) * 0.4) }} className="font-semibold leading-none">
          {memberInitials(member)}
        </span>
      )}
    </div>
  );
}

function OverflowPill({
  size,
  count,
  border,
}: {
  size: number;
  count: number;
  border: number;
}) {
  const label = count > 99 ? "99+" : `+${count}`;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderWidth: border,
        borderStyle: border ? "solid" : undefined,
        borderColor: border ? "var(--color-content-bg)" : undefined,
      }}
      className="rounded-full bg-[var(--color-surface-alt)] text-[var(--color-fg)] flex items-center justify-center box-border"
    >
      <span
        style={{ fontSize: Math.round((size - border * 2) * 0.32) }}
        className="font-semibold leading-none tabular-nums"
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Renders a compact avatar stack for a household:
 *  - 1 member  → single circle filling the container
 *  - 2 members → diagonal pair (top-left, bottom-right)
 *  - 3 members → triangle (top-center, bottom-left, bottom-right)
 *  - 4+ members → same triangle layout but the bottom-right slot
 *    becomes a "+N" pill covering the hidden members
 *
 * If no preview members are available we fall back to a plain
 * household-color disc with name initials so the rail still renders.
 */
export function HouseholdAvatarStack({
  members,
  totalMembers,
  size = 44,
  fallbackName,
  fallbackColor,
  className,
}: Props) {
  if (!members || members.length === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackColor || "var(--color-accent)",
        }}
        className={clsx(
          "rounded-full flex items-center justify-center text-white font-semibold",
          className,
        )}
      >
        <span style={{ fontSize: Math.round(size * 0.36) }} className="leading-none">
          {nameInitials(fallbackName || "?")}
        </span>
      </div>
    );
  }

  const total = totalMembers ?? members.length;
  const shown = members.slice(0, total > 3 ? 2 : 3);
  const overflow = Math.max(0, total - shown.length);
  const slotCount = shown.length + (overflow > 0 ? 1 : 0);

  const border = Math.max(1, Math.round(size * 0.045));

  if (slotCount === 1) {
    return (
      <div
        style={{ width: size, height: size }}
        className={clsx("relative", className)}
      >
        <Avatar size={size} member={shown[0]} border={0} />
      </div>
    );
  }

  if (slotCount === 2) {
    // Each avatar is sized so two overlap diagonally with a generous
    // intersection — the top-left sits flush with the top-left corner
    // and the bottom-right sits flush with the bottom-right corner.
    const s = Math.round(size * 0.78);
    return (
      <div
        style={{ width: size, height: size }}
        className={clsx("relative", className)}
      >
        <div className="absolute top-0 left-0">
          <Avatar size={s} member={shown[0]} border={border} />
        </div>
        <div className="absolute bottom-0 right-0">
          {shown.length === 2 ? (
            <Avatar size={s} member={shown[1]} border={border} />
          ) : (
            <OverflowPill size={s} count={overflow} border={border} />
          )}
        </div>
      </div>
    );
  }

  // Triangle (3 slots). Bigger than a naive 1/√3 packing so the avatars
  // feel substantive — overlap between neighbours is expected.
  const s = Math.round(size * 0.68);
  const hOffset = Math.round((size - s) / 2);
  return (
    <div
      style={{ width: size, height: size }}
      className={clsx("relative", className)}
    >
      <div
        className="absolute top-0"
        style={{ left: hOffset }}
      >
        <Avatar size={s} member={shown[0]} border={border} />
      </div>
      <div className="absolute bottom-0 left-0">
        <Avatar size={s} member={shown[1]} border={border} />
      </div>
      <div className="absolute bottom-0 right-0">
        {shown.length === 3 ? (
          <Avatar size={s} member={shown[2]} border={border} />
        ) : (
          <OverflowPill size={s} count={overflow} border={border} />
        )}
      </div>
    </div>
  );
}
