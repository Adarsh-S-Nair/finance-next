"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { Dropdown } from "@slate-ui/react";
import { useUser } from "../providers/UserProvider";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";

const FALLBACK_COLOR = '#71717a';

// When multiple categories share a group color, shift lightness so
// they read as "tints of the same family" rather than identical slices.
function dedupeColors(categories) {
  const seen = {};          // hex -> count of times seen so far
  return categories.map((cat) => {
    const base = (cat.hex_color || FALLBACK_COLOR).toLowerCase();
    const n = seen[base] || 0;
    seen[base] = n + 1;
    if (n === 0) return base;
    // Parse hex → RGB, then lighten/darken per occurrence
    const r = parseInt(base.slice(1, 3), 16);
    const g = parseInt(base.slice(3, 5), 16);
    const b = parseInt(base.slice(5, 7), 16);
    // Alternate: odd occurrences lighten, even darken — keeps them distinct
    const shift = n % 2 === 1 ? 40 * Math.ceil(n / 2) : -30 * Math.ceil(n / 2);
    const clamp = (v) => Math.max(0, Math.min(255, v + shift));
    return `#${[r, g, b].map(clamp).map(v => v.toString(16).padStart(2, '0')).join('')}`;
  });
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth'); // 'thisMonth' or 'last30'

  // Period options for dropdown
  const periodOptions = [
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last 30 Days', value: 'last30' },
  ];

  // Resolve colors — shift lightness when siblings share a group color
  const sliceColors = useMemo(() => dedupeColors(categories), [categories]);


  const containerRef = React.useRef(null);

  useEffect(() => {
    // If externalData is provided for the default period, use it
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

        // Calculate date range based on selected period
        const now = new Date();
        let apiUrl;

        if (selectedPeriod === 'thisMonth') {
          // Use exact month boundaries for consistency with monthly-overview
          const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          apiUrl = `/api/transactions/spending-by-category?startDate=${startDate}&endDate=${endDate}`;
        } else {
          // Last 30 days
          apiUrl = `/api/transactions/spending-by-category?days=30`;
        }

        const res = await authFetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();

        // Take top 10 categories for comprehensive breakdown
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

  // Handle Mouse Leave Logic
  useEffect(() => {
    if (activeIndex === null) return;

    const handleGlobalMouseMove = (e) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (isOutside) {
        setActiveIndex(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [activeIndex]);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  const onPieClick = (data, index) => {
    if (!data || !data.id) return;
    // Navigate to transactions filtered by this specific category
    router.push(`/transactions?categoryIds=${data.id}&dateRange=30days`);
  };

  const renderFormattedAmount = (value) => {
    return <CurrencyAmount amount={value} cents />;
  };

  // Empty donut (single gray ring) for when there's no spending data
  const EmptyDonut = () => (
    <div className="flex-1 min-h-0 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ value: 1 }]}
            cx="50%"
            cy="48%"
            innerRadius={110}
            outerRadius={128}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
            style={{ pointerEvents: 'none' }}
          >
            <Cell fill="var(--color-border)" opacity={0.5} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-[4%]">
        <div className="text-3xl font-medium text-[var(--color-muted)] mb-1">
          {renderFormattedAmount(0)}
        </div>
        <div className="text-xs text-[var(--color-muted)] font-medium text-center px-4">
          No spending yet
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-[440px]">
        <div className="animate-pulse flex flex-col h-full">
          {/* Header */}
          <div className="pb-2 flex items-center justify-between">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
            <div className="h-6 bg-[var(--color-border)] rounded w-24" />
          </div>
          {/* Donut chart placeholder */}
          <div className="flex justify-center items-center flex-1">
            <div className="w-56 h-56 rounded-full border-[18px] border-[var(--color-border)] opacity-30" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[400px]">
        <div className="h-full flex items-center justify-center text-zinc-400">
          Failed to load data
        </div>
      </div>
    );
  }

  return (
    <div className="h-[440px] relative">
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Custom Header with Dropdown */}
        <div className="pb-2 flex items-center justify-between">
          <div className="card-header">
            Top Spending
          </div>
          <Dropdown
            label={periodOptions.find(p => p.value === selectedPeriod)?.label || 'This Month'}
            items={periodOptions.map(option => ({
              label: option.label,
              onClick: () => setSelectedPeriod(option.value),
              selected: option.value === selectedPeriod
            }))}
            size="sm"
            align="right"
          />
        </div>

        {/* Chart Section - empty donut when no categories */}
        {categories.length === 0 ? (
          <EmptyDonut />
        ) : (
        <div className="flex-1 min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Drop shadow for depth on idle segments */}
                <filter id="donut-shadow" x="-15%" y="-15%" width="140%" height="140%">
                  <feDropShadow dx="2" dy="2" stdDeviation="2.5" floodColor="black" floodOpacity="0.2" />
                </filter>
              </defs>
              {/* Shadow Pie Layer — offset dark shadow behind visible segments */}
              <Pie
                data={categories}
                cx="50%"
                cy="48%"
                innerRadius={110}
                outerRadius={128}
                paddingAngle={4}
                cornerRadius={9}
                dataKey="total_spent"
                stroke="none"
                isAnimationActive={false}
                style={{ pointerEvents: 'none' }}
                filter="url(#donut-shadow)"
              >
                {categories.map((entry, index) => (
                  <Cell
                    key={`shadow-${index}`}
                    fill="black"
                    opacity={0}
                  />
                ))}
              </Pie>
              {/* Visible Pie Layer */}
              <Pie
                data={categories}
                cx="50%"
                cy="48%"
                innerRadius={110}
                outerRadius={128}
                paddingAngle={4}
                cornerRadius={9}
                dataKey="total_spent"
                stroke="none"
                isAnimationActive={false}
                style={{ pointerEvents: 'none' }}
              >
                {categories.map((entry, index) => {
                  const color = sliceColors[index] || FALLBACK_COLOR;
                  const isActive = activeIndex === index;
                  const isIdle = activeIndex === null;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isActive || isIdle ? color : 'var(--color-border)'}
                      opacity={isActive ? 1 : isIdle ? 0.65 : 0.35}
                      filter={isActive ? 'url(#donut-glow)' : 'url(#donut-shadow)'}
                      style={{
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        outline: 'none',
                        transform: isActive ? 'scale(1.04)' : 'scale(1)',
                        transformOrigin: 'center center',
                        transformBox: 'fill-box'
                      }}
                    />
                  );
                })}
              </Pie>

              {/* Invisible Interaction Layer - Larger hit area */}
              <Pie
                data={categories}
                cx="50%"
                cy="48%"
                innerRadius={90} // Start slightly inside
                outerRadius={148} // Extend further out
                paddingAngle={4}
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

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-[4%]">
            <div className="text-3xl font-medium text-[var(--color-fg)] mb-1">
              {(() => {
                const value = activeIndex !== null ? categories[activeIndex].total_spent : totalSpending;
                return renderFormattedAmount(value);
              })()}
            </div>
            <div className="text-xs text-[var(--color-muted)] font-medium text-center px-4">
              {activeIndex !== null ? categories[activeIndex].label : periodOptions.find(p => p.value === selectedPeriod)?.label}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
