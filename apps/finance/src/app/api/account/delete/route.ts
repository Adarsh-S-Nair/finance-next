import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUserId } from "../../../../lib/api/auth";
import { deleteUserCompletely } from "../../../../lib/accountDeletion/deleteUserCompletely";

export async function POST(req: NextRequest) {
  try {
    // Middleware has already verified the token and injected x-user-id
    const userId = requireVerifiedUserId(req);

    const result = await deleteUserCompletely(userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Unexpected error in account delete:", e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
