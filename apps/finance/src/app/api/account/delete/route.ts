import { NextResponse } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { deleteUserCompletely } from "../../../../lib/accountDeletion/deleteUserCompletely";

export const POST = withAuth("account:delete", async (_req, userId) => {
  const result = await deleteUserCompletely(userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
});
