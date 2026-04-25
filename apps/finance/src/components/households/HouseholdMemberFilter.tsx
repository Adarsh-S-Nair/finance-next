"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useHouseholdMeta } from "../providers/HouseholdDataProvider";
import { Tooltip } from "@zervo/ui";

type Member = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

function memberName(m: Member) {
  const parts = [m.first_name, m.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return m.email || "Member";
}

function memberInitials(m: Member) {
  const f = m.first_name?.[0];
  const l = m.last_name?.[0];
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  if (m.email) return m.email[0].toUpperCase();
  return "?";
}

/**
 * Portaled into the topbar's #topbar-tools-portal slot. Renders a row of
 * circular member avatars; clicking one mutes/unmutes that member's
 * accounts across the whole household page via HouseholdDataProvider's
 * excludedMemberIds state.
 */
export default function HouseholdMemberFilter() {
  const { members, excludedMemberIds, toggleMember } = useHouseholdMeta();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !members || members.length <= 1) return null;
  const portalTarget = document.getElementById("topbar-tools-portal");
  if (!portalTarget) return null;

  const content = (
    <div className="flex items-center pr-2">
      <AnimatePresence initial={false}>
        {(members as Member[]).map((member, index) => {
          const muted = excludedMemberIds.has(member.user_id);
          const label = muted
            ? `Show ${memberName(member)}'s accounts`
            : `Hide ${memberName(member)}'s accounts`;
          return (
            <Tooltip key={member.user_id} content={label} side="bottom">
              <motion.button
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                whileHover={{ scale: 1.12, y: -1 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                onClick={() => toggleMember(member.user_id)}
                aria-pressed={!muted}
                aria-label={label}
                style={{ marginLeft: index === 0 ? 0 : -8, zIndex: members.length - index }}
                className={clsx(
                  "relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold outline-none cursor-pointer",
                  "ring-2 ring-[var(--color-content-bg)] transition-[opacity,filter] duration-200",
                  muted
                    ? "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
                    : "opacity-100",
                  "bg-[var(--color-accent)] text-[var(--color-on-accent,white)]",
                )}
              >
                {member.avatar_url ? (

                  <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{memberInitials(member)}</span>
                )}
              </motion.button>
            </Tooltip>
          );
        })}
      </AnimatePresence>
    </div>
  );

  return createPortal(content, portalTarget);
}
