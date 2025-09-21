import { getPlaidClient } from '../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';

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

    // Decode JWT header to get key ID
    const header = JSON.parse(Buffer.from(signature.split('.')[0], 'base64url').toString());
    
    if (header.alg !== 'ES256') {
      console.error('Invalid algorithm:', header.alg);
      return false;
    }

    // Get Plaid's public key using the correct endpoint
    const response = await fetch('https://production.plaid.com/webhook_verification_key/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
      body: JSON.stringify({
        key_id: header.kid
      })
    });

    if (!response.ok) {
      console.error('Failed to get verification key:', response.status, await response.text());
      return false;
    }

    const { key } = await response.json();
    
    // Convert JWK to PEM format using Node.js crypto
    const jwk = {
      kty: key.kty,
      crv: key.crv,
      x: key.x,
      y: key.y,
      use: key.use
    };
    
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    
    // Verify the JWT
    const decoded = jwt.verify(signature, publicKey, { algorithms: ['ES256'] });
    
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
    // Handle case-insensitive header name
    const signature = request.headers.get('plaid-verification') || request.headers.get('Plaid-Verification');

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
    case 'SYNC_UPDATES_AVAILABLE':
      // Trigger transaction sync for this item
      console.log(`Triggering transaction sync for item: ${item_id}, webhook_code: ${webhook_code}`);
      // TODO: Re-enable sync call once we fix the URL issue
      console.log('Sync call temporarily disabled for debugging');
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
      // New accounts are available, sync them
      console.log('New accounts available for item:', item_id);
      try {
        // Get fresh account data from Plaid
        const { getAccounts } = await import('../../../../lib/plaidClient');
        const accountsResponse = await getAccounts(plaidItem.access_token);
        const { accounts } = accountsResponse;
        
        console.log(`🔍 DEBUG: Found ${accounts.length} accounts for item ${item_id}`);
        console.log('🔍 DEBUG: Full accounts response:', JSON.stringify(accountsResponse, null, 2));
        console.log('🔍 DEBUG: Individual accounts:', accounts.map(acc => ({
          account_id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        })));
        
        // Process and save new accounts
        const accountsToInsert = accounts.map(account => ({
          user_id: plaidItem.user_id,
          item_id: item_id,
          account_id: account.account_id,
          name: account.name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          balances: account.balances,
          access_token: plaidItem.access_token,
          account_key: `${item_id}_${account.account_id}`,
          institution_id: plaidItem.institution_id,
          plaid_item_id: plaidItem.id,
        }));

        console.log('🔍 DEBUG: Accounts to insert:', accountsToInsert.map(acc => ({
          account_id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype
        })));

        // Insert accounts (upsert to handle duplicates)
        const { data: accountsData, error: accountsError } = await supabase
          .from('accounts')
          .upsert(accountsToInsert, {
            onConflict: 'plaid_item_id,account_id'
          })
          .select();

        if (accountsError) {
          console.error('Error upserting new accounts:', accountsError);
        } else {
          console.log(`✅ Synced ${accountsData.length} accounts for item ${item_id}`);
          console.log('🔍 DEBUG: Synced accounts:', accountsData.map(acc => ({
            id: acc.id,
            account_id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype
          })));
        }
      } catch (accountSyncError) {
        console.error('Error syncing new accounts:', accountSyncError);
      }
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
