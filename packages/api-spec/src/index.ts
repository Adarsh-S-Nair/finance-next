/**
 * Single source of truth for every public API endpoint exposed by Zervo.
 *
 * Two surfaces consume this:
 *   - apps/finance         renders the public-facing reference docs at
 *                          `zervo.app/docs/api/[id]` from these entries.
 *   - apps/developer       renders the signed-in interactive playground
 *                          at `developer.zervo.app/playground/[id]` from
 *                          these entries and from matching route handlers
 *                          under `apps/developer/src/app/api/v*`.
 *
 * Keep the entries in lockstep with the route implementations — the
 * entries here are what external devs see.
 */

export type ParamLocation = "query" | "path" | "body" | "header";
export type ParamType = "string" | "number" | "boolean";

export type ApiParameter = {
  name: string;
  in: ParamLocation;
  type: ParamType;
  required?: boolean;
  description: string;
  /** Initial value shown in the Try-it form. Also used in code samples. */
  example?: string | number | boolean;
  /** Value the server uses when the parameter is omitted. Shown in docs. */
  default?: string | number | boolean;
};

export type ApiResponseSpec = {
  status: number;
  description: string;
  /** Example JSON body — rendered as the canonical response shape. */
  example: unknown;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEndpoint = {
  /** Stable URL slug used in docs / playground routes (e.g. `/docs/api/trades`). */
  id: string;
  method: HttpMethod;
  /** Path relative to the developer.zervo.app origin. Starts with `/api/v...`. */
  path: string;
  /** Short noun phrase used as the page header. */
  summary: string;
  description?: string;
  parameters?: ApiParameter[];
  responses: ApiResponseSpec[];
};

export const ENDPOINTS: readonly ApiEndpoint[] = [
  {
    id: "trades",
    method: "GET",
    path: "/api/v1/trades",
    summary: "List trades",
    description:
      "Recent US Congress trade disclosures, most recently filed first. All filters are optional; combine them to narrow the feed. Currently returns a hand-coded sample dataset while ingestion is being built — the schema is final.",
    parameters: [
      {
        name: "limit",
        in: "query",
        type: "number",
        required: false,
        description: "How many trades to return. Capped at 100.",
        example: 5,
        default: 25,
      },
      {
        name: "ticker",
        in: "query",
        type: "string",
        required: false,
        description: "Filter to trades involving this stock symbol. Case-insensitive.",
        example: "NVDA",
      },
      {
        name: "politician",
        in: "query",
        type: "string",
        required: false,
        description: 'Filter to one politician by id (e.g. "pelosi-nancy").',
      },
      {
        name: "chamber",
        in: "query",
        type: "string",
        required: false,
        description: 'Filter by chamber. One of "house" or "senate".',
      },
      {
        name: "since",
        in: "query",
        type: "string",
        required: false,
        description:
          "ISO date (YYYY-MM-DD). Only return trades disclosed on or after this date.",
      },
    ],
    responses: [
      {
        status: 200,
        description: "Recent trade disclosures.",
        example: {
          data: [
            {
              id: "trd_01hxr3y6mqe9j7v4ng7t2k3p1a",
              disclosed_at: "2026-05-14",
              transacted_at: "2026-05-02",
              politician: {
                id: "pelosi-nancy",
                name: "Nancy Pelosi",
                chamber: "house",
                party: "D",
                state: "CA",
              },
              asset: { ticker: "NVDA", name: "NVIDIA Corp", type: "stock" },
              transaction_type: "buy",
              amount_range: { min: 1000000, max: 5000000 },
              source_url: "https://disclosures-clerk.house.gov/",
            },
          ],
          has_more: false,
        },
      },
    ],
  },
];

export function getEndpoint(id: string): ApiEndpoint | undefined {
  return ENDPOINTS.find((e) => e.id === id);
}
