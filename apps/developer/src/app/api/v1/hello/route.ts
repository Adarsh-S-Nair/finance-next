import { NextResponse } from "next/server";

/**
 * GET /api/v1/hello — see lib/api-registry.ts for the canonical spec.
 *
 * Public, no auth. CORS open so external devs can hit it directly from
 * the browser when testing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("name") ?? "world";
  const name = raw.trim().slice(0, 100) || "world";

  return NextResponse.json(
    { message: `Hello, ${name}!` },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
