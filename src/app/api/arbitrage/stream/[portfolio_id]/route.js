import { createClient } from '@supabase/supabase-js';

/**
 * Server-Sent Events (SSE) endpoint for live arbitrage price streaming
 * Connects to Supabase real-time and pushes price updates to the client
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request, { params }) {
  const { portfolio_id } = await params;

  if (!portfolio_id) {
    return new Response('Portfolio ID required', { status: 400 });
  }

  // Create a new Supabase client for this stream
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify portfolio exists
  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id, crypto_assets, metadata')
    .eq('id', portfolio_id)
    .single();

  if (portfolioError || !portfolio) {
    return new Response('Portfolio not found', { status: 404 });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let isStreamClosed = false;
  let channel = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const sendEvent = (eventType, data) => {
        if (isStreamClosed) return;
        try {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (e) {
          // Stream closed
          isStreamClosed = true;
        }
      };

      // Send heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        if (isStreamClosed) {
          clearInterval(heartbeat);
          return;
        }
        sendEvent('heartbeat', { timestamp: new Date().toISOString() });
      }, 15000);

      // Send initial prices from portfolio metadata
      if (portfolio.metadata?.latestPrices) {
        sendEvent('prices', {
          prices: portfolio.metadata.latestPrices,
          opportunities: portfolio.metadata.latestOpportunities || [],
          timestamp: portfolio.metadata.lastPriceUpdate || new Date().toISOString(),
        });
      }

      sendEvent('connected', {
        portfolioId: portfolio_id,
        message: 'Connected to price stream',
        timestamp: new Date().toISOString(),
      });

      // Subscribe to portfolio metadata updates (contains latest prices)
      channel = supabase
        .channel(`stream-portfolio-${portfolio_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'portfolios',
            filter: `id=eq.${portfolio_id}`,
          },
          (payload) => {
            const newData = payload.new;
            if (newData?.metadata?.latestPrices) {
              sendEvent('prices', {
                prices: newData.metadata.latestPrices,
                opportunities: newData.metadata.latestOpportunities || [],
                timestamp: newData.metadata.lastPriceUpdate || new Date().toISOString(),
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'arbitrage_price_history',
            filter: `portfolio_id=eq.${portfolio_id}`,
          },
          (payload) => {
            const row = payload.new;
            sendEvent('price_tick', {
              crypto: row.crypto,
              exchange: row.exchange,
              price: row.price,
              volume24h: row.volume_24h,
              isLowest: row.is_lowest,
              isHighest: row.is_highest,
              spreadPercent: row.spread_percent,
              timestamp: row.created_at,
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            sendEvent('subscribed', {
              message: 'Subscribed to real-time updates',
              timestamp: new Date().toISOString(),
            });
          }
        });

      // Handle stream close
      request.signal.addEventListener('abort', () => {
        isStreamClosed = true;
        clearInterval(heartbeat);
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    },
    cancel() {
      isStreamClosed = true;
      if (channel) {
        supabase.removeChannel(channel);
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
