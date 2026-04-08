"use client";

import React, { useState, useEffect } from "react";

type IndexData = {
  symbol: string;
  name: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
};

function MiniSparkline({
  data,
  color,
  width = 64,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + (1 - (v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPrice(price: number, symbol: string): string {
  // VIX shows decimals, indices show whole numbers
  if (symbol === "^VIX") {
    return price.toFixed(2);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(price);
}

export default function MarketIndicesCard() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchIndices() {
      try {
        const res = await fetch("/api/market-data/indices");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) setIndices(data);
      } catch (err) {
        console.error("[MarketIndicesCard] fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchIndices();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="card-header mb-3">Market Watch</div>
      <hr className="border-t border-[var(--color-border)]/40 -mx-5 mb-3" />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="space-y-1.5">
                <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
                <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
              </div>
              <div className="h-6 w-16 bg-[var(--color-border)] rounded" />
              <div className="space-y-1.5 text-right">
                <div className="h-3 w-14 bg-[var(--color-border)] rounded ml-auto" />
                <div className="h-3 w-10 bg-[var(--color-border)] rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {indices.map((idx) => {
            const isPositive = idx.changePercent >= 0;
            const color = isPositive
              ? "var(--color-success)"
              : "var(--color-danger)";

            return (
              <div key={idx.symbol} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--color-fg)]">
                    {idx.shortName}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {formatPrice(idx.price, idx.symbol)}
                  </div>
                </div>

                <MiniSparkline data={idx.sparkline} color={color} />

                <div className="text-right shrink-0">
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color }}
                  >
                    {isPositive ? "+" : ""}
                    {idx.changePercent.toFixed(2)}%
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color }}
                  >
                    {isPositive ? "+" : ""}
                    {idx.change.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
