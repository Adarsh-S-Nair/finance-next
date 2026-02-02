import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { createLogger } from '../../../../lib/logger';

const DISABLE_WEBHOOKS = process.env.NODE_ENV !== 'production' && process.env.DISABLE_WEBHOOKS === '1';

// Verify webhook using Plaid's JWT verification
async function verifyWebhookSignature(payload, signature, logger) {
  try {
    if (!signature) {
      logger.warn('No Plaid-Verification header found, skipping verification in development');
      return true; // Allow in development
    }

    // Decode JWT header to get key ID
    const header = JSON.parse(Buffer.from(signature.split('.')[0], 'base64url').toString());

    if (header.alg !== 'ES256') {
      logger.error('Invalid algorithm in webhook signature', null, { algorithm: header.alg });
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
      const errorText = await response.text();
      logger.error('Failed to get verification key', null, { status: response.status, error: errorText });
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
      logger.error('Payload hash mismatch in webhook verification');
      return false;
    }

    // Verify the webhook is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.iat > 300) {
      logger.error('Webhook is too old', null, { age: now - decoded.iat });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Webhook verification failed', error);
    return false;
  }
}

export async function POST(request) {
  // Create a request-specific logger with unique correlation ID
  const logger = createLogger('plaid-webhook');
  const opId = logger.startOperation('webhook-processing');

  try {
    if (DISABLE_WEBHOOKS) {
      logger.info('Webhook disabled in development mode');
      logger.endOperation(opId, { status: 'disabled' });
      await logger.flush();
      return Response.json({ received: true, disabled: true });
    }

    const payload = await request.text();
    // Handle case-insensitive header name
    const signature = request.headers.get('plaid-verification') || request.headers.get('Plaid-Verification');

    logger.info('Webhook received', {
      hasSignature: !!signature,
      payloadLength: payload.length
    });

    // Verify webhook signature using Plaid's JWT verification
    if (!(await verifyWebhookSignature(payload, signature, logger))) {
      logger.error('Invalid webhook signature');
      logger.endOperation(opId, { status: 'invalid_signature' });
      await logger.flush();
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData = JSON.parse(payload);
    logger.info('Webhook verified and parsed', {
      webhook_type: webhookData.webhook_type,
      webhook_code: webhookData.webhook_code,
      item_id: webhookData.item_id
    });

    // Handle different webhook types
    switch (webhookData.webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhookData, logger);
        break;
      case 'ITEM':
        await handleItemWebhook(webhookData, logger);
        break;
      case 'HOLDINGS':
        await handleHoldingsWebhook(webhookData, logger);
        break;
      case 'INVESTMENTS_TRANSACTIONS':
        await handleInvestmentTransactionsWebhook(webhookData, logger);
        break;
      case 'RECURRING_TRANSACTIONS':
        await handleRecurringTransactionsWebhook(webhookData, logger);
        break;
      default:
        logger.warn('Unhandled webhook type', { webhook_type: webhookData.webhook_type });
    }

    logger.info('Webhook processed successfully');
    logger.endOperation(opId, { status: 'success', webhook_type: webhookData.webhook_type });
    await logger.flush();
    return Response.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook', error);
    logger.endOperation(opId, { status: 'error' });
    await logger.flush();
    return Response.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleTransactionsWebhook(webhookData, logger) {
  const { webhook_code, item_id, new_transactions, removed_transactions } = webhookData;
  const txLogger = logger.child('transactions');

  txLogger.info('Processing TRANSACTIONS webhook', {
    webhook_code,
    item_id,
    new_transactions_count: new_transactions || 0,
    removed_transactions_count: removed_transactions?.length || 0
  });

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    txLogger.error('Plaid item not found for webhook', null, { item_id, error: itemError });
    return;
  }

  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
    case 'SYNC_UPDATES_AVAILABLE':
      // Trigger transaction sync for this item
      txLogger.info('Triggering transaction sync', { item_id, webhook_code });

      // Mark item as ready for recurring transactions on HISTORICAL_UPDATE or SYNC_UPDATES_AVAILABLE
      if (webhook_code === 'HISTORICAL_UPDATE' || webhook_code === 'SYNC_UPDATES_AVAILABLE') {
        const { error: updateReadyError } = await supabaseAdmin
          .from('plaid_items')
          .update({ recurring_ready: true })
          .eq('id', plaidItem.id);

        if (updateReadyError) {
          txLogger.error('Error updating recurring_ready', null, { error: updateReadyError });
        } else {
          txLogger.info('Marked item as recurring_ready', { item_id, webhook_code });
        }
      }

      try {
        // Import and call the sync function directly instead of making HTTP request
        const { POST: syncEndpoint } = await import('../transactions/sync/route.js');

        // Create a mock request object for the sync endpoint
        const syncRequest = {
          json: async () => ({
            plaidItemId: plaidItem.id,
            userId: plaidItem.user_id,
            forceSync: false
          })
        };

        const syncResponse = await syncEndpoint(syncRequest);

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          txLogger.info('Transaction sync completed', {
            item_id,
            transactions_synced: syncResult.transactions_synced,
            pending_transactions_updated: syncResult.pending_transactions_updated
          });
        } else {
          const errorData = await syncResponse.json();
          txLogger.error('Transaction sync failed', null, { item_id, error: errorData });
        }
      } catch (error) {
        txLogger.error('Error in webhook-triggered sync', error, { item_id });
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      if (removed_transactions && removed_transactions.length > 0) {
        txLogger.info('Removing transactions', {
          item_id,
          count: removed_transactions.length
        });

        const { error: deleteError } = await supabaseAdmin
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removed_transactions);

        if (deleteError) {
          txLogger.error('Error removing transactions', null, { error: deleteError });
        } else {
          txLogger.info('Successfully removed transactions', { count: removed_transactions.length });
        }
      }
      break;

    default:
      txLogger.warn('Unhandled transaction webhook code', { webhook_code });
  }
}

async function handleItemWebhook(webhookData, logger) {
  const { webhook_code, item_id } = webhookData;
  const itemLogger = logger.child('item');

  itemLogger.info('Processing ITEM webhook', { webhook_code, item_id });

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    itemLogger.error('Plaid item not found for webhook', null, { item_id, error: itemError });
    return;
  }

  switch (webhook_code) {
    case 'ERROR':
      // Update plaid item with error status
      itemLogger.error('Item error webhook received', null, {
        item_id,
        plaid_error: webhookData.error
      });

      const { error: updateError } = await supabaseAdmin
        .from('plaid_items')
        .update({
          sync_status: 'error',
          last_error: webhookData.error?.error_message || 'Unknown error'
        })
        .eq('id', plaidItem.id);

      if (updateError) {
        itemLogger.error('Error updating plaid item status', null, { error: updateError });
      }
      break;

    case 'NEW_ACCOUNTS_AVAILABLE':
      // New accounts are available, sync them
      itemLogger.info('New accounts available', { item_id });
      try {
        // Get fresh account data from Plaid
        const { getAccounts, getInstitution } = await import('../../../../lib/plaidClient');
        const accountsResponse = await getAccounts(plaidItem.access_token);
        const { accounts, institution_id } = accountsResponse;

        itemLogger.info('Fetched accounts from Plaid', { item_id, count: accounts.length });

        // Get institution info (with fallback)
        let institutionData = null;
        const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;

        if (actualInstitutionId) {
          try {
            const institution = await getInstitution(actualInstitutionId);

            // Upsert institution in database
            const { data: instData, error: institutionError } = await supabaseAdmin
              .from('institutions')
              .upsert({
                institution_id: institution.institution_id,
                name: institution.name,
                logo: institution.logo,
                primary_color: institution.primary_color,
                url: institution.url,
              }, {
                onConflict: 'institution_id'
              })
              .select()
              .single();

            if (institutionError) {
              itemLogger.warn('Error upserting institution', { error: institutionError });
            } else {
              institutionData = instData;
            }
          } catch (instError) {
            itemLogger.warn('Error getting institution info, continuing without it', { error: instError.message });
          }
        }

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
          institution_id: institutionData?.id || null,
          plaid_item_id: plaidItem.id,
        }));

        // Insert accounts (upsert to handle duplicates)
        const { data: accountsData, error: accountsError } = await supabaseAdmin
          .from('accounts')
          .upsert(accountsToInsert, {
            onConflict: 'plaid_item_id,account_id'
          })
          .select();

        if (accountsError) {
          itemLogger.error('Error upserting new accounts', null, { error: accountsError });
        } else {
          itemLogger.info('Synced accounts', { item_id, count: accountsData.length });
        }
      } catch (accountSyncError) {
        itemLogger.error('Error syncing new accounts', accountSyncError, { item_id });
      }
      break;

    case 'PENDING_EXPIRATION':
      itemLogger.warn('Item pending expiration', { item_id });
      break;

    case 'USER_PERMISSION_REVOKED':
      itemLogger.warn('User permission revoked', { item_id });
      break;

    default:
      itemLogger.warn('Unhandled item webhook code', { webhook_code });
  }
}

async function handleHoldingsWebhook(webhookData, logger) {
  const { webhook_code, item_id, error, new_holdings, updated_holdings } = webhookData;
  const holdingsLogger = logger.child('holdings');

  holdingsLogger.info('Processing HOLDINGS webhook', {
    webhook_code,
    item_id,
    has_error: !!error,
    new_holdings: new_holdings || 0,
    updated_holdings: updated_holdings || 0
  });

  // Check for errors in webhook payload
  if (error) {
    holdingsLogger.error('Holdings webhook contains error', null, {
      item_id,
      error_type: error.error_type,
      error_code: error.error_code,
      error_message: error.error_message
    });
    return;
  }

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    holdingsLogger.error('Plaid item not found for webhook', null, { item_id, error: itemError });
    return;
  }

  switch (webhook_code) {
    case 'DEFAULT_UPDATE':
      // Trigger holdings sync for this item
      holdingsLogger.info('Triggering holdings sync', { item_id, webhook_code });

      try {
        // Import and call the sync function directly instead of making HTTP request
        const { POST: syncEndpoint } = await import('../investments/holdings/sync/route.js');

        // Create a mock request object for the sync endpoint
        const syncRequest = {
          json: async () => ({
            plaidItemId: plaidItem.id,
            userId: plaidItem.user_id,
            forceSync: false
          })
        };

        const syncResponse = await syncEndpoint(syncRequest);

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          holdingsLogger.info('Holdings sync completed', {
            item_id,
            portfolios_created: syncResult.portfolios_created,
            holdings_synced: syncResult.holdings_synced
          });
        } else {
          const errorData = await syncResponse.json();
          holdingsLogger.error('Holdings sync failed', null, { item_id, error: errorData });
        }
      } catch (syncError) {
        holdingsLogger.error('Error in webhook-triggered holdings sync', syncError, { item_id });
      }
      break;

    default:
      holdingsLogger.warn('Unhandled holdings webhook code', { webhook_code });
  }
}

async function handleInvestmentTransactionsWebhook(webhookData, logger) {
  const { webhook_code, item_id, error, new_investments_transactions, canceled_investments_transactions } = webhookData;
  const invTxLogger = logger.child('investment-transactions');

  invTxLogger.info('Processing INVESTMENTS_TRANSACTIONS webhook', {
    webhook_code,
    item_id,
    has_error: !!error,
    new_investments_transactions: new_investments_transactions || 0,
    canceled_investments_transactions: canceled_investments_transactions || 0
  });

  // Check for errors in webhook payload
  if (error) {
    invTxLogger.error('Investment transactions webhook contains error', null, {
      item_id,
      error_type: error.error_type,
      error_code: error.error_code,
      error_message: error.error_message
    });
    return;
  }

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    invTxLogger.error('Plaid item not found for webhook', null, { item_id, error: itemError });
    return;
  }

  switch (webhook_code) {
    case 'DEFAULT_UPDATE':
    case 'HISTORICAL_UPDATE':
      // Trigger investment transactions sync for this item
      invTxLogger.info('Triggering investment transactions sync', { item_id, webhook_code });

      try {
        // Import and call the sync function directly instead of making HTTP request
        const { POST: syncEndpoint } = await import('../investments/transactions/sync/route.js');

        // Create a mock request object for the sync endpoint
        const syncRequest = {
          json: async () => ({
            plaidItemId: plaidItem.id,
            userId: plaidItem.user_id,
            forceSync: false
          })
        };

        const syncResponse = await syncEndpoint(syncRequest);

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          invTxLogger.info('Investment transactions sync completed', {
            item_id,
            transactions_synced: syncResult.transactions_synced
          });
        } else {
          const errorData = await syncResponse.json();
          invTxLogger.error('Investment transactions sync failed', null, { item_id, error: errorData });
        }
      } catch (syncError) {
        invTxLogger.error('Error in webhook-triggered investment transactions sync', syncError, { item_id });
      }
      break;

    default:
      invTxLogger.warn('Unhandled investment transactions webhook code', { webhook_code });
  }
}

async function handleRecurringTransactionsWebhook(webhookData, logger) {
  const { webhook_code, item_id } = webhookData;
  const recurringLogger = logger.child('recurring');

  recurringLogger.info('Processing RECURRING_TRANSACTIONS webhook', {
    webhook_code,
    item_id
  });

  // Get the plaid item from database
  const { data: plaidItem, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('item_id', item_id)
    .single();

  if (itemError || !plaidItem) {
    recurringLogger.error('Plaid item not found for webhook', null, { item_id, error: itemError });
    return;
  }

  switch (webhook_code) {
    case 'RECURRING_TRANSACTIONS_UPDATE':
      // Recurring transactions data is ready or has been updated
      recurringLogger.info('Triggering recurring transactions sync', { item_id, webhook_code });

      try {
        // Import and call the sync function directly
        const { POST: syncEndpoint } = await import('../recurring/sync/route.js');

        // Create a mock request object for the sync endpoint
        const syncRequest = {
          json: async () => ({
            userId: plaidItem.user_id
          })
        };

        const syncResponse = await syncEndpoint(syncRequest);

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          recurringLogger.info('Recurring transactions sync completed', {
            item_id,
            synced: syncResult.synced
          });
        } else {
          const errorData = await syncResponse.json();
          recurringLogger.error('Recurring transactions sync failed', null, { item_id, error: errorData });
        }
      } catch (syncError) {
        recurringLogger.error('Error in webhook-triggered recurring sync', syncError, { item_id });
      }
      break;

    default:
      recurringLogger.warn('Unhandled recurring transactions webhook code', { webhook_code });
  }
}
