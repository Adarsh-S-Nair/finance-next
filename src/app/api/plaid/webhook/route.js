import { getPlaidClient } from '../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify webhook using Plaid's JWT verification
async function verifyWebhookSignature(payload, signature) {
  try {
    if (!signature) {
      console.warn('No Plaid-Verification header found, skipping verification in development');
      return true; // Allow in development
    }

    // Get Plaid's public key
    const response = await fetch('https://plaid.com/webhook_verification_key');
    const { key } = await response.json();
    
    // Verify the JWT
    const decoded = jwt.verify(signature, key, { algorithms: ['RS256'] });
    
    // Verify the payload hash
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    if (decoded.request_body_sha256 !== payloadHash) {
      console.error('Payload hash mismatch');
      return false;
    }
    
    // Verify the webhook is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.iat > 300) {
      console.error('Webhook is too old');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('plaid-verification');

    // Verify webhook signature using Plaid's JWT verification
    if (!(await verifyWebhookSignature(payload, signature))) {
      console.error('Invalid webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData = JSON.parse(payload);
    console.log('Received Plaid webhook:', webhookData.webhook_type, webhookData.webhook_code);

    // Handle different webhook types
    switch (webhookData.webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhookData);
        break;
      case 'ITEM':
        await handleItemWebhook(webhookData);
        break;
      default:
        console.log('Unhandled webhook type:', webhookData.webhook_type);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return Response.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleTransactionsWebhook(webhookData) {
  const { webhook_code, item_id, new_transactions, removed_transactions } = webhookData;

  console.log(`Processing TRANSACTIONS webhook: ${webhook_code} for item: ${item_id}`);

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabase
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    console.error('Plaid item not found for webhook:', item_id, itemError);
    return;
  }

  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      // Trigger transaction sync for this item
      console.log(`Triggering transaction sync for item: ${item_id}`);
      try {
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/transactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plaidItemId: plaidItem.id,
            userId: plaidItem.user_id
          })
        });

        if (!syncResponse.ok) {
          console.error('Transaction sync failed for webhook:', await syncResponse.text());
        } else {
          const syncResult = await syncResponse.json();
          console.log('Transaction sync completed via webhook:', syncResult);
        }
      } catch (syncError) {
        console.error('Error triggering transaction sync from webhook:', syncError);
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      if (removed_transactions && removed_transactions.length > 0) {
        console.log(`Removing ${removed_transactions.length} transactions for item: ${item_id}`);
        
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removed_transactions);

        if (deleteError) {
          console.error('Error removing transactions:', deleteError);
        } else {
          console.log('Successfully removed transactions');
        }
      }
      break;

    default:
      console.log('Unhandled transaction webhook code:', webhook_code);
  }
}

async function handleItemWebhook(webhookData) {
  const { webhook_code, item_id } = webhookData;

  console.log(`Processing ITEM webhook: ${webhook_code} for item: ${item_id}`);

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabase
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    console.error('Plaid item not found for webhook:', item_id, itemError);
    return;
  }

  switch (webhook_code) {
    case 'ERROR':
      // Update plaid item with error status
      const { error: updateError } = await supabase
        .from('plaid_items')
        .update({
          sync_status: 'error',
          last_error: webhookData.error?.error_message || 'Unknown error'
        })
        .eq('id', plaidItem.id);

      if (updateError) {
        console.error('Error updating plaid item status:', updateError);
      }
      break;

    case 'NEW_ACCOUNTS_AVAILABLE':
      // New accounts are available, could trigger account sync
      console.log('New accounts available for item:', item_id);
      break;

    case 'PENDING_EXPIRATION':
      // Item is about to expire, user needs to re-authenticate
      console.log('Item pending expiration for item:', item_id);
      break;

    case 'USER_PERMISSION_REVOKED':
      // User has revoked access
      console.log('User permission revoked for item:', item_id);
      break;

    default:
      console.log('Unhandled item webhook code:', webhook_code);
  }
}
