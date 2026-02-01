/**
 * Proxy API for fetching prices from multiple exchanges
 * Avoids CORS issues by making server-side requests
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Exchange API configurations
const EXCHANGE_APIS = {
  coinbase: {
    name: 'Coinbase',
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return parseFloat(data.data.amount);
      } catch {
        return null;
      }
    },
  },
  binance: {
    name: 'Binance',
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return parseFloat(data.price);
      } catch {
        return null;
      }
    },
  },
  kraken: {
    name: 'Kraken',
    fetchPrice: async (symbol) => {
      try {
        const krakenSymbol = symbol === 'BTC' ? 'XBT' : symbol;
        const pair = `${krakenSymbol}USD`;
        const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.error && data.error.length > 0) return null;
        const resultKey = Object.keys(data.result)[0];
        if (!resultKey) return null;
        return parseFloat(data.result[resultKey].c[0]);
      } catch {
        return null;
      }
    },
  },
  kucoin: {
    name: 'KuCoin',
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}-USDT`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.code !== '200000' || !data.data) return null;
        return parseFloat(data.data.price);
      } catch {
        return null;
      }
    },
  },
  bybit: {
    name: 'Bybit',
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}USDT`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.retCode !== 0 || !data.result?.list?.[0]) return null;
        return parseFloat(data.result.list[0].lastPrice);
      } catch {
        return null;
      }
    },
  },
  okx: {
    name: 'OKX',
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.code !== '0' || !data.data?.[0]) return null;
        return parseFloat(data.data[0].last);
      } catch {
        return null;
      }
    },
  },
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cryptosParam = searchParams.get('cryptos');
    const exchangesParam = searchParams.get('exchanges');

    if (!cryptosParam || !exchangesParam) {
      return NextResponse.json(
        { error: 'Missing required params: cryptos, exchanges' },
        { status: 400 }
      );
    }

    const cryptos = cryptosParam.split(',').map(c => c.trim().toUpperCase());
    const exchanges = exchangesParam.split(',').map(e => e.trim().toLowerCase());

    // Fetch all prices in parallel
    const prices = {};

    await Promise.all(
      cryptos.map(async (crypto) => {
        prices[crypto] = {};

        await Promise.all(
          exchanges.map(async (exchangeKey) => {
            const exchange = EXCHANGE_APIS[exchangeKey];
            if (exchange?.fetchPrice) {
              const price = await exchange.fetchPrice(crypto);
              if (price !== null) {
                prices[crypto][exchangeKey] = price;
              }
            }
          })
        );
      })
    );

    return NextResponse.json({
      prices,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Exchange prices error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
