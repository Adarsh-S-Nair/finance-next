import { createClient } from '@supabase/supabase-js';

/**
 * Server-Sent Events (SSE) endpoint for live arbitrage price streaming
 * Polls the database every 5 seconds and pushes updates to the client
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { portfolio_id } = await params;

  console.log(`[SSE] New connection request for portfolio: ${portfolio_id}`);

  if (!portfolio_id) {
    console.log('[SSE] Error: Portfolio ID required');
    return new Response('Portfolio ID required', { status: 400 });
  }

  // Create a new Supabase client for this stream
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify portfolio exists and get initial data
  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id, crypto_assets, metadata')
    .eq('id', portfolio_id)
    .single();

  if (portfolioError || !portfolio) {
    console.log(`[SSE] Error: Portfolio not found: ${portfolio_id}`);
    return new Response('Portfolio not found', { status: 404 });
  }

  console.log(`[SSE] Portfolio found: ${portfolio_id}, starting stream...`);

  // Set up SSE stream with polling
  const encoder = new TextEncoder();
  let isStreamClosed = false;
  let lastPriceUpdate = portfolio.metadata?.lastPriceUpdate || null;
  let pollInterval = null;

  const stream = new ReadableStream({
    start(controller) {
      // Helper to send SSE events
      const sendEvent = (eventType, data) => {
        if (isStreamClosed) return false;
        try {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
          return true;
        } catch (e) {
          console.log(`[SSE] Error sending event: ${e.message}`);
          isStreamClosed = true;
          return false;
        }
      };

      // Send initial connection event
      sendEvent('connected', {
        portfolioId: portfolio_id,
        message: 'Connected to price stream',
        timestamp: new Date().toISOString(),
      });

      // Send initial prices if available
      if (portfolio.metadata?.latestPrices) {
        console.log(`[SSE] Sending initial prices for ${portfolio_id}`);
        sendEvent('prices', {
          prices: portfolio.metadata.latestPrices,
          opportunities: portfolio.metadata.latestOpportunities || [],
          timestamp: portfolio.metadata.lastPriceUpdate || new Date().toISOString(),
        });
      }

      // Poll for updates
      const pollForUpdates = async () => {
        if (isStreamClosed) {
          console.log(`[SSE] Stream closed, stopping poll for ${portfolio_id}`);
          return;
        }

        try {
          // Fetch latest portfolio data
          const { data: updatedPortfolio, error } = await supabase
            .from('portfolios')
            .select('metadata')
            .eq('id', portfolio_id)
            .single();

          if (error) {
            console.log(`[SSE] Poll error: ${error.message}`);
            return;
          }

          const newPriceUpdate = updatedPortfolio?.metadata?.lastPriceUpdate;

          // Always send prices if we have them (with current timestamp to force UI update)
          if (updatedPortfolio?.metadata?.latestPrices) {
            const hasChanged = newPriceUpdate !== lastPriceUpdate;
            if (hasChanged) {
              console.log(`[SSE] New prices for ${portfolio_id}: ${newPriceUpdate}`);
              lastPriceUpdate = newPriceUpdate;
            }

            const sent = sendEvent('prices', {
              prices: updatedPortfolio.metadata.latestPrices,
              opportunities: updatedPortfolio.metadata.latestOpportunities || [],
              timestamp: new Date().toISOString(), // Always use current time to force UI update
              dbTimestamp: newPriceUpdate,
            });

            if (!sent) {
              console.log(`[SSE] Failed to send prices, closing stream for ${portfolio_id}`);
              clearInterval(pollInterval);
            }
          }
        } catch (e) {
          console.log(`[SSE] Poll exception: ${e.message}`);
        }
      };

      // Start polling
      console.log(`[SSE] Starting poll interval (${POLL_INTERVAL}ms) for ${portfolio_id}`);
      pollInterval = setInterval(pollForUpdates, POLL_INTERVAL);

      // Also send a heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        if (isStreamClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        sendEvent('heartbeat', { timestamp: new Date().toISOString() });
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected from ${portfolio_id}`);
        isStreamClosed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
      });
    },
    cancel() {
      console.log(`[SSE] Stream cancelled for ${portfolio_id}`);
      isStreamClosed = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
