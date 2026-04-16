import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { removeItem } from "../../../../lib/plaid/client";
import { requireVerifiedUserId } from "../../../../lib/api/auth";
import { stripe } from "../../../../lib/stripe/client";

export async function POST(req: NextRequest) {
  try {
    // Middleware has already verified the token and injected x-user-id
    const userId = requireVerifiedUserId(req);

    // Step 1: Get all Plaid items for this user
    console.log(`Fetching Plaid items for user: ${userId}`);
    const { data: plaidItems, error: plaidItemsError } = await supabaseAdmin
      .from("plaid_items")
      .select("*")
      .eq("user_id", userId);

    if (plaidItemsError) {
      console.error("Error fetching Plaid items:", plaidItemsError);
      return NextResponse.json({ error: "Failed to fetch Plaid items" }, { status: 500 });
    }

    // Step 2: Remove all Plaid items before deleting user
    if (plaidItems && plaidItems.length > 0) {
      console.log(`Found ${plaidItems.length} Plaid items to remove`);
      
      const plaidRemovalResults = [];
      
      const DEAD_ITEM_CODES = ['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN', 'ITEM_LOGIN_REQUIRED'];

      for (const plaidItem of plaidItems) {
        try {
          console.log(`Removing Plaid item: ${plaidItem.item_id}`);
          await removeItem(plaidItem.access_token);
          plaidRemovalResults.push({ itemId: plaidItem.item_id, success: true });
          console.log(`Successfully removed Plaid item: ${plaidItem.item_id}`);
        } catch (plaidError: any) {
          const plaidErrorCode = plaidError?.response?.data?.error_code;
          if (DEAD_ITEM_CODES.includes(plaidErrorCode)) {
            // Item already gone on Plaid's side — treat as success for account deletion
            console.warn(`Plaid item ${plaidItem.item_id} already removed or invalid (${plaidErrorCode}). Treating as success.`);
            plaidRemovalResults.push({ itemId: plaidItem.item_id, success: true });
          } else {
            // For account deletion, Plaid cleanup is best-effort — log and continue
            console.error(`Failed to remove Plaid item ${plaidItem.item_id} (${plaidErrorCode ?? 'unknown'}):`, plaidError);
            plaidRemovalResults.push({ 
              itemId: plaidItem.item_id, 
              success: false, 
              error: plaidError.message || "Unknown error" 
            });
          }
        }
      }

      // For account deletion, Plaid cleanup is best-effort — log failures but don't block deletion
      const failedRemovals = plaidRemovalResults.filter(result => !result.success);
      if (failedRemovals.length > 0) {
        console.warn("Some Plaid items could not be removed (best-effort, continuing with deletion):", failedRemovals);
      } else {
        console.log("All Plaid items removed successfully");
      }
    } else {
      console.log("No Plaid items found for user");
    }

    // Step 3: Clean up Stripe subscriptions and customer
    try {
      if (!stripe) {
        console.log("Stripe not configured — skipping Stripe cleanup");
      } else {
        console.log(`Fetching Stripe customer ID for user: ${userId}`);
        const { data: profileData, error: profileFetchErr } = await supabaseAdmin
          .from("user_profiles")
          .select("stripe_customer_id")
          .eq("id", userId)
          .single();

        if (profileFetchErr && profileFetchErr.code !== "PGRST116") {
          console.error("Error fetching user profile for Stripe cleanup:", profileFetchErr);
        } else if (profileData?.stripe_customer_id) {
          const customerId = profileData.stripe_customer_id;
          console.log(`Found Stripe customer: ${customerId}`);

          // Cancel all active subscriptions
          const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active" });
          console.log(`Found ${subscriptions.data.length} active subscription(s) to cancel`);
          for (const sub of subscriptions.data) {
            console.log(`Cancelling subscription: ${sub.id}`);
            await stripe.subscriptions.cancel(sub.id);
            console.log(`Cancelled subscription: ${sub.id}`);
          }

          // Delete the Stripe customer
          console.log(`Deleting Stripe customer: ${customerId}`);
          await stripe.customers.del(customerId);
          console.log(`Deleted Stripe customer: ${customerId}`);
        } else {
          console.log("No Stripe customer ID found for user — skipping Stripe cleanup");
        }
      }
    } catch (stripeErr: any) {
      console.error("Stripe cleanup failed (continuing with account deletion):", stripeErr?.message ?? stripeErr);
    }

    // Step 4: Clean up profile data (optional; cascade can handle in DB if configured)
    const { error: profileErr } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    if (profileErr && profileErr.code !== "PGRST116") {
      // ignore not-found; otherwise propagate
      console.error("Failed to delete user profile:", profileErr);
      return NextResponse.json({ error: "Failed to delete profile" }, { status: 400 });
    }

    // Step 5: Delete auth user (only after all Plaid items are successfully removed)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("Failed to delete auth user:", deleteErr);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("Unexpected error in account delete:", e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}


