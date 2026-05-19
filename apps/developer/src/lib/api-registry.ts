/**
 * Single source of truth for every public API endpoint exposed by the
 * Zervo developer portal. The route handlers under `src/app/api/v*` are
 * the runtime implementations; the entries here drive the docs UI (the
 * `<EndpointPlayground>` component reads from this registry to render
 * parameter tables, the interactive Try-it form, and the cURL / fetch
 * code samples). Keep the two in lockstep — the registry is what
 * external devs see.
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
  /** Stable URL slug used in playground routes (e.g. `/endpoints/hello`). */
  id: string;
  method: HttpMethod;
  /** Path relative to the developer.zervo.app origin. Starts with `/api/v...`. */
  path: string;
  /** Short noun phrase used as the playground header. */
  summary: string;
  description?: string;
  parameters?: ApiParameter[];
  responses: ApiResponseSpec[];
};

export const ENDPOINTS: readonly ApiEndpoint[] = [
  {
    id: "hello",
    method: "GET",
    path: "/api/v1/hello",
    summary: "Hello world",
    description:
      "A test endpoint that returns a greeting. Useful for verifying the API is reachable and that your client is wired up correctly. No auth required.",
    parameters: [
      {
        name: "name",
        in: "query",
        type: "string",
        required: false,
        description: "Who to greet. Trimmed and capped at 100 characters.",
        example: "Adarsh",
        default: "world",
      },
    ],
    responses: [
      {
        status: 200,
        description: "The greeting message.",
        example: { message: "Hello, Adarsh!" },
      },
    ],
  },
];

export function getEndpoint(id: string): ApiEndpoint | undefined {
  return ENDPOINTS.find((e) => e.id === id);
}
