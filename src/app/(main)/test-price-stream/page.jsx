"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Simple test page to verify WebSocket price streaming works
 * Connects directly to Coinbase WebSocket API (free, no rate limits)
 */

const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"];

export default function TestPriceStreamPage() {
  const wsRef = useRef(null);
  const [status, setStatus] = useState("disconnected");
  const [prices, setPrices] = useState({});
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    console.log("[WS] Connecting to Coinbase WebSocket...");
    setStatus("connecting");

    const ws = new WebSocket(COINBASE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected! Subscribing to products:", PRODUCTS);
      setStatus("connected");

      // Subscribe to ticker channel for real-time price updates
      const subscribeMsg = {
        type: "subscribe",
        product_ids: PRODUCTS,
        channels: ["ticker"],
      };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "ticker") {
        const { product_id, price, time } = data;
        const numPrice = parseFloat(price);

        console.log(`[PRICE] ${product_id}: $${numPrice.toLocaleString()}`);

        setPrices((prev) => ({
          ...prev,
          [product_id]: {
            price: numPrice,
            time: time,
            lastUpdate: new Date().toISOString(),
          },
        }));
        setTickCount((c) => c + 1);
      } else if (data.type === "subscriptions") {
        console.log("[WS] Subscribed to channels:", data.channels);
      } else if (data.type === "error") {
        console.error("[WS] Error:", data.message);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] WebSocket error:", error);
      setStatus("error");
    };

    ws.onclose = (event) => {
      console.log("[WS] Disconnected. Code:", event.code, "Reason:", event.reason);
      setStatus("disconnected");
    };

    // Cleanup on unmount
    return () => {
      console.log("[WS] Cleaning up WebSocket connection");
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="p-6 font-mono text-sm">
      <h1 className="text-lg font-bold mb-4">WebSocket Price Stream Test</h1>

      <div className="mb-4">
        <span className="text-gray-500">Status: </span>
        <span className={
          status === "connected" ? "text-green-500" :
          status === "connecting" ? "text-yellow-500" :
          "text-red-500"
        }>
          {status}
        </span>
        <span className="text-gray-500 ml-4">Ticks received: {tickCount}</span>
      </div>

      <div className="space-y-2">
        {PRODUCTS.map((product) => {
          const data = prices[product];
          return (
            <div key={product} className="flex gap-4">
              <span className="w-24">{product}:</span>
              {data ? (
                <>
                  <span className="text-green-400 w-32">
                    ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(data.lastUpdate).toLocaleTimeString()}
                  </span>
                </>
              ) : (
                <span className="text-gray-500">waiting...</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-gray-500 text-xs">
        <p>Open browser console (F12) to see live price logs</p>
        <p>This connects directly to Coinbase WebSocket - no server needed</p>
      </div>
    </div>
  );
}
