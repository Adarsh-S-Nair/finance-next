/**
 * Assistant refinement for a detected income profile.
 *
 * The deterministic detector nails the numbers (amount, cadence, next date)
 * but leaves the employer as a raw bank descriptor — "Direct deposit from
 * 100-SFDC INC." This pass asks the model to turn that into a name a person
 * recognises ("Salesforce") and to sanity-check that it really looks like
 * employment income. Best-effort and side-effect-free: the runner persists
 * the result and silently keeps the algorithm's label if this is skipped or
 * fails (e.g. no API key configured).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomeProfile } from "./detect";

const SET_INCOME_TOOL: Anthropic.Messages.Tool = {
  name: "set_income_summary",
  description:
    "Return a cleaned-up summary of the user's primary income source.",
  input_schema: {
    type: "object",
    properties: {
      employer: {
        type: "string",
        description:
          'Clean, human-recognisable employer/source name, e.g. "Salesforce". Strip bank boilerplate ("Direct deposit from", "From") and payroll codes. If you cannot confidently map it to a known company, return a tidied version of the raw label rather than guessing.',
      },
      is_paycheck: {
        type: "boolean",
        description:
          "True if this clearly looks like real employment/payroll income (vs. interest, a refund, or a transfer).",
      },
      note: {
        type: "string",
        description:
          "Optional one-line caveat if something looks off; empty string if all good.",
      },
    },
    required: ["employer", "is_paycheck"],
  },
};

const SYSTEM =
  "You clean up noisy bank payroll descriptors into recognisable employer " +
  "names for a personal finance app. Be conservative: only map to a " +
  "well-known company when the descriptor clearly indicates it; otherwise " +
  "just tidy the raw text. Never invent details you can't infer.";

export interface RefinedIncome {
  employer: string;
  isPaycheck: boolean;
  note: string;
}

export async function refineIncomeProfile(
  profile: IncomeProfile,
  client: Anthropic,
  model: string,
): Promise<RefinedIncome | null> {
  const p = profile.primary;
  if (!p) return null;

  const sample = p.deposits
    .slice(-6)
    .map((d) => `${d.date}: $${d.amount.toFixed(2)}`)
    .join("\n");
  const others =
    profile.streams
      .filter((s) => s !== p)
      .map((s) => `${s.kind} ~$${s.expectedAmount}/${s.cadence}`)
      .join(", ") || "none";

  const userMessage =
    `A user's primary income source, detected from their bank deposits.\n\n` +
    `Raw label: "${p.label}"\n` +
    `Cadence: ${p.cadence}\n` +
    `Typical amount: $${p.expectedAmount}\n` +
    `Recent deposits:\n${sample}\n\n` +
    `Other income streams: ${others}\n\n` +
    `Return a clean employer/source name a person would recognise. For ` +
    `example, a payroll descriptor like "Direct deposit from 100-SFDC INC." ` +
    `is Salesforce.`;

  const response = await client.messages.create({
    model,
    max_tokens: 300,
    system: SYSTEM,
    tools: [SET_INCOME_TOOL],
    tool_choice: { type: "tool", name: "set_income_summary" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<Anthropic.Messages.ContentBlock, { type: "tool_use" }> =>
      b.type === "tool_use" && b.name === "set_income_summary",
  );
  if (!toolUse) return null;

  const input = toolUse.input as {
    employer?: string;
    is_paycheck?: boolean;
    note?: string;
  } | null;
  const employer = input?.employer?.trim();
  if (!employer) return null;

  return {
    employer,
    isPaycheck: input?.is_paycheck !== false,
    note: (input?.note ?? "").trim(),
  };
}
