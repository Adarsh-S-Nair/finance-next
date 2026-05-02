"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBookmark, FiX } from "react-icons/fi";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

export type MemoryWidgetData = {
  action?: "remember";
  memory_id?: string;
  content?: string;
  duplicate?: boolean;
  error?: string;
};

/**
 * Subtle inline confirmation that a memory was saved. Mirrors the
 * minimal aesthetic of the other widgets — no card, just a small row.
 *
 * Renders as: [bookmark icon] Remembered: <fact>            [forget]
 *
 * Click "forget" → DELETE the memory and fade the row out. Useful
 * when the agent saved something the user didn't actually want
 * remembered ("the agent jumped to conclusions; let me undo that
 * right here without going to settings").
 */
export default function MemoryWidget({
  data,
}: {
  data: MemoryWidgetData;
}) {
  const [forgotten, setForgotten] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  if (data.error) return <WidgetError message={data.error} />;
  if (!data.memory_id || !data.content) return null;

  // Memory id is stable across renders — no need to fetch persisted
  // state separately. If it was already deleted on the server, the
  // forget call is idempotent.
  const memoryId = data.memory_id;
  const content = data.content;

  async function handleForget() {
    setForgetting(true);
    try {
      await authFetch(`/api/agent/memories/${memoryId}`, {
        method: "DELETE",
      });
      setForgotten(true);
    } catch {
      // Silent failure. The user can still delete from /settings/agent
      // if it didn't actually go through.
      setForgotten(true);
    } finally {
      setForgetting(false);
    }
  }

  return (
    <WidgetFrame>
      <AnimatePresence mode="wait" initial={false}>
        {forgotten ? (
          <motion.div
            key="forgotten"
            initial={{ opacity: 1, height: "auto" }}
            animate={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          />
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-3"
          >
            <FiBookmark
              className="h-3.5 w-3.5 text-[var(--color-muted)] flex-shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <div className="flex-1 min-w-0 text-[13px] text-[var(--color-muted)] leading-relaxed">
              <span className="text-[var(--color-fg)]">
                {data.duplicate ? "Already remembered" : "Remembered"}
              </span>
              {": "}
              {content}
            </div>
            <button
              type="button"
              onClick={handleForget}
              disabled={forgetting}
              aria-label="Forget this memory"
              className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-rose-500 disabled:opacity-50 transition-colors"
            >
              <FiX className="h-3 w-3" strokeWidth={2.5} />
              forget
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}
