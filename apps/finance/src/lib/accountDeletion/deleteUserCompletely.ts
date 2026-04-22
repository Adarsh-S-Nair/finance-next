import { supabaseAdmin } from "../supabase/admin";
import { removeItem } from "../plaid/client";
import { stripe } from "../stripe/client";
import { decryptPlaidToken } from "../crypto/plaidTokens";

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Full account teardown for a single user. Called by two entry points:
 *   - POST /api/account/delete           — user deleting themselves
 *   - DELETE /api/admin/users/[id]       — admin deleting someone else
 *
 * Both entry points MUST funnel through here so the Plaid / Stripe / DB
 * cleanup stays identical. Getting this wrong costs us real money (Plaid
 * bills per connected item, so skipping /item/remove leaves us paying for
 * items we can no longer see once the DB row is gone).
 *
 * Ordering matters:
 *   1. Call Plaid /item/remove for every item we know about. This is
 *      best-effort — dead-item error codes are treated as success so we
 *      can still finish the deletion if Plaid already forgot the item.
 *   2. Cancel any active Stripe subscriptions and delete the customer.
 *      Best-effort — we log and continue on error. (We'd rather finish
 *      the DB deletion and clean up Stripe manually than leave the user
 *      in a half-deleted state.)
 *   3. Delete the user_profiles row. FKs cascade most product data.
 *   4. Delete the auth.users row. This is the point of no return.
 */
export async function deleteUserCompletely(userId: string): Promise<DeleteUserResult> {
  // Step 1: Get all Plaid items for this user
  console.log(`[deleteUser ${userId}] Fetching Plaid items`);
  const { data: plaidItems, error: plaidItemsError } = await supabaseAdmin
    .from("plaid_items")
    .select("*")
    .eq("user_id", userId);

  if (plaidItemsError) {
    console.error(`[deleteUser ${userId}] Error fetching Plaid items:`, plaidItemsError);
    return { ok: false, status: 500, error: "Failed to fetch Plaid items" };
  }

  // Step 2: Remove all Plaid items (best-effort)
  if (plaidItems && plaidItems.length > 0) {
    console.log(`[deleteUser ${userId}] Found ${plaidItems.length} Plaid items to remove`);
    const DEAD_ITEM_CODES = ["ITEM_NOT_FOUND", "INVALID_ACCESS_TOKEN", "ITEM_LOGIN_REQUIRED"];
    const failed: Array<{ itemId: string; error: string }> = [];

    for (const plaidItem of plaidItems) {
      try {
        console.log(`[deleteUser ${userId}] Removing Plaid item: ${plaidItem.item_id}`);
        // plaid_items.access_token is encrypted at rest; decrypt for Plaid SDK.
        await removeItem(decryptPlaidToken(plaidItem.access_token));
        console.log(`[deleteUser ${userId}] Successfully removed Plaid item: ${plaidItem.item_id}`);
      } catch (plaidError: unknown) {
        const err = plaidError as { response?: { data?: { error_code?: string } }; message?: string };
        const plaidErrorCode = err?.response?.data?.error_code;
        if (plaidErrorCode && DEAD_ITEM_CODES.includes(plaidErrorCode)) {
          console.warn(
            `[deleteUser ${userId}] Plaid item ${plaidItem.item_id} already dead (${plaidErrorCode}); treating as success.`,
          );
        } else {
          console.error(
            `[deleteUser ${userId}] Failed to remove Plaid item ${plaidItem.item_id} (${plaidErrorCode ?? "unknown"}):`,
            plaidError,
          );
          failed.push({ itemId: plaidItem.item_id, error: err?.message || "Unknown error" });
        }
      }
    }

    if (failed.length > 0) {
      console.warn(
        `[deleteUser ${userId}] Some Plaid items could not be removed (best-effort, continuing):`,
        failed,
      );
    } else {
      console.log(`[deleteUser ${userId}] All Plaid items removed successfully`);
    }
  } else {
    console.log(`[deleteUser ${userId}] No Plaid items found`);
  }

  // Step 3: Clean up Stripe subscriptions and customer (best-effort)
  try {
    if (!stripe) {
      console.log(`[deleteUser ${userId}] Stripe not configured — skipping`);
    } else {
      const { data: profileData, error: profileFetchErr } = await supabaseAdmin
        .from("user_profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();

      if (profileFetchErr && profileFetchErr.code !== "PGRST116") {
        console.error(`[deleteUser ${userId}] Error fetching profile for Stripe cleanup:`, profileFetchErr);
      } else if (profileData?.stripe_customer_id) {
        const customerId = profileData.stripe_customer_id;
        console.log(`[deleteUser ${userId}] Found Stripe customer: ${customerId}`);

        const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active" });
        console.log(`[deleteUser ${userId}] Cancelling ${subscriptions.data.length} active subscription(s)`);
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
          console.log(`[deleteUser ${userId}] Cancelled subscription ${sub.id}`);
        }

        await stripe.customers.del(customerId);
        console.log(`[deleteUser ${userId}] Deleted Stripe customer ${customerId}`);
      } else {
        console.log(`[deleteUser ${userId}] No Stripe customer ID found — skipping`);
      }
    }
  } catch (stripeErr: unknown) {
    const err = stripeErr as { message?: string };
    console.error(`[deleteUser ${userId}] Stripe cleanup failed (continuing):`, err?.message ?? stripeErr);
  }

  // Step 4: Delete profile row
  const { error: profileErr } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
  if (profileErr && profileErr.code !== "PGRST116") {
    console.error(`[deleteUser ${userId}] Failed to delete user profile:`, profileErr);
    return { ok: false, status: 400, error: "Failed to delete profile" };
  }

  // Step 5: Delete auth user (point of no return)
  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error(`[deleteUser ${userId}] Failed to delete auth user:`, deleteErr);
    return { ok: false, status: 400, error: "Failed to delete account" };
  }

  return { ok: true };
}
