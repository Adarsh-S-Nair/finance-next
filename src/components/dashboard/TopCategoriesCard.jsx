"use client";

import React, { useState, useEffect, useMemo } from "react";
import Card from "../ui/Card";
import { useUser } from "../UserProvider";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";

// Generate shades of accent color for donut slices
function generateAccentShades(accentColor, count) {
  // If no valid accent color, return grays
  if (!accentColor) {
    return Array(count).fill("var(--color-muted)");
  }

  // Parse the accent color (handle CSS variable or hex)
  const shades = [];
  for (let i = 0; i < count; i++) {
    // Create progressively lighter shades using opacity
    // First slice: 100%, then 75%, 55%, 40%
    const opacities = [1, 0.75, 0.55, 0.40, 0.30];
    const opacity = opacities[i] ?? 0.30;
    shades.push({ color: accentColor, opacity });
  }
  return shades;
}

export default function TopCategoriesCard() {
  const { user, profile } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  // Get accent color from profile or CSS variable
  const accentColor = useMemo(() => {
    if (profile?.accent_color) return profile.accent_color;
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#18181b';
    }
    return '#18181b';
  }, [profile?.accent_color]);

  // Generate shades for the categories
  const accentShades = useMemo(() => {
    return generateAccentShades(accentColor, categories.length);
  }, [accentColor, categories.length]);

  const containerRef = React.useRef(null);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        // Default to 30 days, grouped by category group
        const res = await fetch(`/api/transactions/spending-by-category?userId=${user.id}&days=30&groupBy=group`);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();

        // Take top 3-4 categories for cleaner look
        const topCategories = data.categories.slice(0, 4);
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
  }, [user?.id]);

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
    router.push(`/transactions?groupIds=${data.id}&dateRange=30days`);
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

  if (loading) {
    return (
      <Card className="h-[400px]">
        <div className="animate-pulse flex flex-col h-full justify-center items-center gap-4">
          <div className="w-40 h-40 rounded-full bg-[var(--color-border)] opacity-20" />
        </div>
      </Card>
    );
  }

  if (error || categories.length === 0) {
    return (
      <Card className="h-[400px]">
        <div className="h-full flex items-center justify-center text-[var(--color-muted)]">
          {error ? "Failed to load data" : "No spending data found"}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="h-[400px] relative">
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Custom Header - Minimalist */}
        <div className="px-6 pt-6 pb-2">
          <div className="text-base font-normal text-[var(--color-fg)] mb-1">
            Top Spending
          </div>
        </div>

        {/* Chart Section */}
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
                  const shade = accentShades[index] || { color: accentColor, opacity: 0.3 };
                  const baseOpacity = shade.opacity;
                  const hoverOpacity = activeIndex === index ? baseOpacity : (activeIndex !== null ? baseOpacity * 0.3 : baseOpacity);
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={shade.color}
                      opacity={hoverOpacity}
                      style={{
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Bouncy effect
                        outline: 'none',
                        transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
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
              {activeIndex !== null ? categories[activeIndex].label : "Last 30 Days"}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
