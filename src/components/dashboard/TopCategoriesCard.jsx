"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import Card from "../ui/Card";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../providers/UserProvider";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";

// Fallback palette when category groups don't have hex_color set
const FALLBACK_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#f43f5e', // rose
  '#a855f7', // purple
];

export default function TopCategoriesCard() {
  const { user } = useUser();
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

  // Get color for each category — use hex_color from category group, fallback to palette
  const getCategoryColor = (entry, index) => {
    if (entry.hex_color && entry.hex_color !== '#6B7280') return entry.hex_color;
    return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  };

  const containerRef = React.useRef(null);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;

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
  }, [user?.id, selectedPeriod]);

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
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    const [main, cents] = formatted.split('.');
    return (
      <span>
        {main}
        <span className="text-xl text-[var(--color-muted)] font-normal">.{cents}</span>
      </span>
    );
  };

  // Empty donut (single gray ring) for when there's no spending data
  const EmptyDonut = () => (
    <div className="flex-1 min-h-0 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ value: 1 }]}
            cx="50%"
            cy="50%"
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
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
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
      <Card padding="none" className="h-[440px]">
        <div className="animate-pulse flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-2 flex items-center justify-between">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
            <div className="h-6 bg-[var(--color-border)] rounded w-24" />
          </div>
          {/* Donut chart placeholder */}
          <div className="flex justify-center items-center flex-1">
            <div className="w-56 h-56 rounded-full border-[18px] border-[var(--color-border)] opacity-30" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[400px]">
        <div className="h-full flex items-center justify-center text-[var(--color-muted)]">
          Failed to load data
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="h-[440px] relative">
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Custom Header with Dropdown */}
        <div className="px-6 pt-8 pb-2 flex items-center justify-between">
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
              {/* Visible Pie Layer */}
              <Pie
                data={categories}
                cx="50%"
                cy="50%"
                innerRadius={110}
                outerRadius={128}
                paddingAngle={4}
                cornerRadius={3}
                dataKey="total_spent"
                stroke="none"
                isAnimationActive={false}
                style={{ pointerEvents: 'none' }} // Pass events through
              >
                {categories.map((entry, index) => {
                  const color = getCategoryColor(entry, index);
                  const isActive = activeIndex === index;
                  const isDimmed = activeIndex !== null && !isActive;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={color}
                      opacity={isDimmed ? 0.25 : isActive ? 1 : 0.85}
                      style={{
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        outline: 'none',
                        transform: isActive ? 'scale(1.03)' : 'scale(1)',
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
                cy="50%"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
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
    </Card>
  );
}
