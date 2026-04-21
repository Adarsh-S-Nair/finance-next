"use client";

/**
 * InvestmentsChart
 *
 * Aggregate portfolio value over time across all of the user's investment
 * accounts. Reads from /api/investments/by-date (which pulls from
 * account_snapshots filtered to type='investment'). Mirrors the look and
 * behavior of the net worth chart on the accounts page, minus the
 * per-category hover breakdown (there's only one category here).
 */

import { useEffect, useMemo, useState } from "react";
import LineChart from "../../../components/ui/LineChart";
import TimeRangeSelector from "../../../components/ui/TimeRangeSelector";
import { authFetch } from "../../../lib/api/fetch";

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ALL_RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

export default function InvestmentsChart({ currentValue, costBasis, userId }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("ALL");
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await authFetch(`/api/investments/by-date?maxDays=365`);
        if (!resp.ok) {
          if (!cancelled) setSeries([]);
          return;
        }
        const json = await resp.json();
        if (!cancelled) setSeries(json?.data || []);
      } catch (err) {
        console.error("Failed to load investments history:", err);
        if (!cancelled) setSeries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Shape the data for LineChart
  const chartData = useMemo(() => {
    const points = (series || []).map((item) => {
      const date = new Date(item.date);
      return {
        dateString: item.date,
        date,
        month: date.toLocaleString("en-US", { month: "short" }),
        monthFull: date.toLocaleString("en-US", { month: "long" }),
        year: date.getFullYear(),
        value: item.value || 0,
      };
    });

    // If we have a live current value but no historical snapshots yet,
    // synthesize a single point so the chart still renders something.
    if (points.length === 0 && currentValue != null) {
      const now = new Date();
      points.push({
        dateString: now.toISOString().split("T")[0],
        date: now,
        month: now.toLocaleString("en-US", { month: "short" }),
        monthFull: now.toLocaleString("en-US", { month: "long" }),
        year: now.getFullYear(),
        value: currentValue,
      });
    }
    return points;
  }, [series, currentValue]);

  // Filter to selected time range
  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (timeRange === "ALL") return chartData;

    const now = new Date();
    let startDate = new Date(now);
    switch (timeRange) {
      case "1D":
        startDate.setDate(now.getDate() - 1);
        break;
      case "1W":
        startDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "YTD":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "1Y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return chartData;
    }

    const filtered = chartData.filter((item) => item.date >= startDate);
    if (filtered.length === 0 && chartData.length > 0) {
      return [chartData[chartData.length - 1]];
    }
    return filtered;
  }, [chartData, timeRange]);

  // LineChart needs at least 2 points; if we only have 1, duplicate it so we
  // get a flat baseline.
  const displayChartData = useMemo(() => {
    if (filteredData.length <= 1) {
      const singlePoint =
        filteredData.length === 1
          ? filteredData[0]
          : chartData.length > 0
            ? chartData[chartData.length - 1]
            : null;
      if (!singlePoint) return [];

      const earlier = new Date(singlePoint.date);
      let daysOffset = 30;
      if (timeRange === "1D") daysOffset = 1;
      if (timeRange === "1W") daysOffset = 7;
      earlier.setDate(earlier.getDate() - daysOffset);

      const flat = {
        ...singlePoint,
        dateString: earlier.toISOString().split("T")[0],
        date: earlier,
        month: earlier.toLocaleString("en-US", { month: "short" }),
        monthFull: earlier.toLocaleString("en-US", { month: "long" }),
        year: earlier.getFullYear(),
      };
      return [flat, singlePoint];
    }
    return filteredData;
  }, [filteredData, chartData, timeRange]);

  // Only show ranges whose lookback covers the actual data span
  const availableRanges = useMemo(() => {
    if (chartData.length === 0) return ["ALL"];
    const now = new Date();
    const oldest = chartData[0].date;
    const diffDays = Math.ceil(Math.abs(now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));

    const ranges = [];
    if (diffDays > 0) ranges.push("1D");
    if (diffDays > 7) ranges.push("1W");
    if (diffDays > 30) ranges.push("1M");
    if (diffDays > 90) ranges.push("3M");

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    if (oldest < startOfYear) ranges.push("YTD");
    if (diffDays > 365) ranges.push("1Y");
    ranges.push("ALL");

    // Preserve canonical order
    return ALL_RANGES.filter((r) => ranges.includes(r));
  }, [chartData]);

  // Hover resolves to active index; fall back to the most recent point
  const displayData =
    activeIndex !== null && displayChartData[activeIndex]
      ? displayChartData[activeIndex]
      : displayChartData[displayChartData.length - 1];

  const startValue = displayChartData[0]?.value ?? 0;
  const currentDisplayValue = displayData?.value ?? currentValue ?? 0;
  const deltaFromStart = currentDisplayValue - startValue;
  const deltaPct = startValue !== 0 ? (deltaFromStart / Math.abs(startValue)) * 100 : 0;

  // Color the line green if net up, red if net down over the visible window
  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return "var(--color-success)";
    const first = displayChartData[0].value;
    const last = displayChartData[displayChartData.length - 1].value;
    return last >= first ? "var(--color-success)" : "var(--color-danger)";
  }, [displayChartData]);

  // Overall gain vs cost basis (not dependent on time range)
  const totalGain = (currentValue ?? 0) - (costBasis ?? 0);
  const totalGainPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;

  if (loading && chartData.length === 0) {
    return (
      <div className="animate-pulse">
        <div className="mb-2 h-3 w-32 rounded bg-[var(--color-border)]" />
        <div className="mb-6 h-8 w-48 rounded bg-[var(--color-border)]" />
        <div className="h-[180px] w-full rounded bg-[var(--color-border)]/40" />
      </div>
    );
  }

  return (
    <div onMouseLeave={() => setActiveIndex(null)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Investments value
          </div>
          <div className="mt-1 text-3xl font-medium tabular-nums text-[var(--color-fg)]">
            {formatCurrency(currentDisplayValue)}
          </div>
          {displayChartData.length >= 2 && (
            <div
              className={`mt-1 text-xs font-medium tabular-nums ${
                deltaFromStart > 0
                  ? "text-emerald-500"
                  : deltaFromStart < 0
                    ? "text-rose-500"
                    : "text-[var(--color-muted)]"
              }`}
            >
              {deltaFromStart > 0 ? "+" : ""}
              {formatCurrency(deltaFromStart)} ({deltaFromStart > 0 ? "+" : ""}
              {deltaPct.toFixed(2)}%)
            </div>
          )}
          {displayChartData.length < 2 && costBasis > 0 && (
            <div
              className={`mt-1 text-xs font-medium tabular-nums ${totalGain >= 0 ? "text-emerald-500" : "text-rose-500"}`}
            >
              {totalGain >= 0 ? "+" : ""}
              {formatCurrency(totalGain)} ({totalGain >= 0 ? "+" : ""}
              {totalGainPct.toFixed(2)}%)
            </div>
          )}
        </div>
        <div className="text-right text-xs text-[var(--color-muted)]">
          {displayData?.dateString
            ? new Date(displayData.dateString).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </div>
      </div>

      {displayChartData.length >= 2 && (
        <>
          <div className="pt-4 pb-2">
            <div
              className="relative w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none"
              tabIndex={-1}
              style={{ outline: "none", height: "200px" }}
            >
              <LineChart
                data={displayChartData}
                dataKey="value"
                width="100%"
                height={200}
                margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
                strokeColor={chartColor}
                strokeWidth={2}
                showArea={true}
                areaOpacity={0.15}
                showDots={false}
                dotRadius={4}
                onMouseMove={(_data, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                showTooltip={false}
                gradientId="investmentsGradient"
                curveType="monotone"
                animationDuration={800}
                xAxisDataKey="dateString"
                yAxisDomain={["dataMin", "dataMax"]}
              />
            </div>
          </div>

          <div className="mt-2 pt-2">
            <TimeRangeSelector
              ranges={availableRanges}
              activeRange={timeRange}
              onRangeChange={(range) => setTimeRange(range)}
              layoutId="investmentsTimeRange"
            />
          </div>
        </>
      )}
    </div>
  );
}
