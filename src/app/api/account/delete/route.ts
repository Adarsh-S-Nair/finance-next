import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { removeItem } from "../../../../lib/plaid/client";
import { requireVerifiedUserId } from "../../../../lib/api/auth";

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
      
      for (const plaidItem of plaidItems) {
        try {
          console.log(`Removing Plaid item: ${plaidItem.item_id}`);
          await removeItem(plaidItem.access_token);
          plaidRemovalResults.push({ itemId: plaidItem.item_id, success: true });
          console.log(`Successfully removed Plaid item: ${plaidItem.item_id}`);
        } catch (plaidError) {
          console.error(`Failed to remove Plaid item ${plaidItem.item_id}:`, plaidError);
          plaidRemovalResults.push({ 
            itemId: plaidItem.item_id, 
            success: false, 
            error: plaidError.message || "Unknown error" 
          });
        }
      }

      // Check if all Plaid removals were successful
      const failedRemovals = plaidRemovalResults.filter(result => !result.success);
      if (failedRemovals.length > 0) {
        console.error("Some Plaid items failed to remove:", failedRemovals);
        return NextResponse.json({ 
          error: "Failed to remove all Plaid items", 
          details: failedRemovals 
        }, { status: 500 });
      }

      console.log("All Plaid items removed successfully");
    } else {
      console.log("No Plaid items found for user");
    }

    // Step 3: Clean up profile data (optional; cascade can handle in DB if configured)
    const { error: profileErr } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    if (profileErr && profileErr.code !== "PGRST116") {
      // ignore not-found; otherwise propagate
      return NextResponse.json({ error: profileErr.message }, { status: 400 });
    }

    // Step 4: Delete auth user (only after all Plaid items are successfully removed)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}


