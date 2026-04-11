"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import SegmentedTabs from "../ui/SegmentedTabs";
import { useUser } from "../providers/UserProvider";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";

// Muted, desaturated palette that fits the zinc-based UI.
// Ordered so adjacent slices always have good contrast.
const SLICE_PALETTE = [
  '#71717a', // zinc-500
  '#a1a1aa', // zinc-400
  '#52525b', // zinc-600
  '#d4d4d8', // zinc-300
  '#3f3f46', // zinc-700
  '#e4e4e7', // zinc-200
  '#a3a3a3', // neutral-400
  '#737373', // neutral-500
  '#d4d4d4', // neutral-300
  '#525252', // neutral-600
];

function getSliceColors(count) {
  return Array.from({ length: count }, (_, i) => SLICE_PALETTE[i % SLICE_PALETTE.length]);
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');

  const periodOptions = [
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last 30 Days', value: 'last30' },
  ];

  const sliceColors = useMemo(() => getSliceColors(categories.length), [categories.length]);

  const containerRef = React.useRef(null);

  useEffect(() => {
    if (externalData && selectedPeriod === 'thisMonth') {
      const topCategories = (externalData.categories || []).slice(0, 10);
      setCategories(topCategories);
      setTotalSpending(externalData.totalSpending || 0);
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    async function fetchData() {
      try {
        setLoading(true);
        const now = new Date();
        let apiUrl;
        if (selectedPeriod === 'thisMonth') {
          const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          apiUrl = `/api/transactions/spending-by-category?startDate=${startDate}&endDate=${endDate}`;
        } else {
          apiUrl = `/api/transactions/spending-by-category?days=30`;
        }
        const res = await authFetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        const topCategories = data.categories.slice(0, 10);
        setCategories(topCategories);
        setTotalSpending(data.totalSpending || 0);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [authLoading, user?.id, selectedPeriod, externalData]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleGlobalMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const isOutside =
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom;
      if (isOutside) setActiveIndex(null);
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [activeIndex]);

  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  const onPieClick = (data) => {
    if (!data || !data.id) return;
    router.push(`/transactions?categoryIds=${data.id}&dateRange=30days`);
  };

  // Display up to 5 categories in the legend
  const legendCategories = categories.slice(0, 5);

  const ChartSkeleton = () => (
    <div className="flex flex-col items-center justify-center flex-1 animate-pulse gap-6">
      <div className="w-44 h-44 rounded-full border-[10px] border-[var(--color-border)] opacity-30" />
      <div className="w-full space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-border)]" />
              <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
            </div>
            <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );

  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="relative w-44 h-44 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[{ value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={70}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="var(--color-border)" opacity={0.4} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-medium text-[var(--color-muted)]">
            <CurrencyAmount amount={0} />
          </div>
        </div>
      </div>
      <div className="text-xs text-[var(--color-muted)] font-medium">
        No spending yet
      </div>
    </div>
  );

  // Values shown in center
  const centerValue = activeIndex !== null ? categories[activeIndex].total_spent : totalSpending;
  const centerLabel = activeIndex !== null
    ? categories[activeIndex].label
    : periodOptions.find(p => p.value === selectedPeriod)?.label;

  return (
    <div className="h-[440px] relative">
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Header */}
        <div className="pb-4 flex items-center justify-between">
          <div className="card-header">Top Spending</div>
          <SegmentedTabs
            options={periodOptions}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            size="sm"
          />
        </div>

        {loading ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            Failed to load data
          </div>
        ) : categories.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Donut */}
            <div className="relative w-full flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="48%"
                    innerRadius="72%"
                    outerRadius="86%"
                    paddingAngle={3}
                    cornerRadius={5}
                    dataKey="total_spent"
                    stroke="none"
                    isAnimationActive={false}
                    style={{ pointerEvents: 'none', outline: 'none' }}
                  >
                    {categories.map((_, index) => {
                      const color = sliceColors[index] || FALLBACK_COLOR;
                      const isActive = activeIndex === index;
                      const isDimmed = activeIndex !== null && !isActive;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isDimmed ? 'var(--color-border)' : color}
                          opacity={isDimmed ? 0.4 : 1}
                          style={{
                            transition: 'all 0.2s ease',
                            outline: 'none',
                          }}
                        />
                      );
                    })}
                  </Pie>

                  {/* Invisible interaction layer */}
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="48%"
                    innerRadius="50%"
                    outerRadius="95%"
                    paddingAngle={3}
                    dataKey="total_spent"
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    onClick={onPieClick}
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                    style={{ cursor: 'pointer' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-[4%]">
                <div className="text-2xl font-medium text-[var(--color-fg)] mb-0.5">
                  <CurrencyAmount amount={centerValue} />
                </div>
                <div className="text-[11px] text-[var(--color-muted)] font-medium">
                  {centerLabel}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="pt-2 space-y-2.5">
              {legendCategories.map((cat, i) => {
                const color = sliceColors[i] || FALLBACK_COLOR;
                const pct = totalSpending > 0
                  ? ((cat.total_spent / totalSpending) * 100).toFixed(0)
                  : 0;
                const isActive = activeIndex === i;
                const isDimmed = activeIndex !== null && !isActive;

                return (
                  <div
                    key={cat.id || i}
                    className="flex items-center justify-between cursor-pointer"
                    style={{
                      opacity: isDimmed ? 0.35 : 1,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => onPieClick(cat)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className={`text-xs truncate ${isActive ? 'text-[var(--color-fg)] font-medium' : 'text-[var(--color-muted)]'}`}
                        style={{ transition: 'color 0.2s ease' }}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs font-semibold text-[var(--color-fg)] tabular-nums">
                        <CurrencyAmount amount={cat.total_spent} />
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)] tabular-nums w-7 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
