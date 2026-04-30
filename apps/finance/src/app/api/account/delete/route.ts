import { NextResponse } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { deleteUserCompletely } from "../../../../lib/accountDeletion/deleteUserCompletely";
import { blockedByImpersonation } from "../../../../lib/impersonation/guard";

export const POST = withAuth("account:delete", async (req, userId) => {
  const blocked = await blockedByImpersonation(req);
  if (blocked) return blocked;

  const result = await deleteUserCompletely(userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
});
