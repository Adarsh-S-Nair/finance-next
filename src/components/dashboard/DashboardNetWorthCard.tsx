"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";
import { FiActivity, FiTrendingUp, FiTrendingDown } from "react-icons/fi";

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 1000 }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Ease out quart
      const ease = 1 - Math.pow(1 - progress, 4);

      setDisplayValue(startValue + (endValue - startValue) * ease);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span>
      {new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(displayValue)}
    </span>
  );
}

export default function DashboardNetWorthCard() {
  const { profile } = useUser();
  const {
    netWorthHistory,
    currentNetWorth,
    loading
  } = useNetWorth();

  // Get accent color - default to system accent
  const accentColor = profile?.accent_color && profile.accent_color.startsWith('#')
    ? profile.accent_color
    : 'var(--color-accent)';

  // Process chart data for percentage change only
  const chartData = useMemo(() => {
    if (!netWorthHistory?.length) return [];

    return netWorthHistory.map(item => ({
      date: new Date(item.date),
      value: item.netWorth,
      dateString: item.date
    }));
  }, [netWorthHistory]);

  // Calculate percentage change (last 30 days or available range)
  const percentChange = useMemo(() => {
    if (chartData.length < 2) return 0;

    const current = chartData[chartData.length - 1].value;
    // Look back ~30 days or start of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startData = chartData.find(d => d.date >= thirtyDaysAgo) || chartData[0];
    const start = startData.value;

    if (start === 0) return 0;
    return ((current - start) / Math.abs(start)) * 100;
  }, [chartData]);

  if (loading) {
    return (
      <Card width="full" className="h-full relative overflow-hidden">
        <div className="animate-pulse flex flex-col h-full justify-between p-2">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24 mb-4" />
          <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-48" />
        </div>
      </Card>
    );
  }

  const netWorthValue = currentNetWorth?.netWorth || 0;

  // Determine styling based on accent color
  const isCustomAccent = profile?.accent_color && profile.accent_color !== 'var(--color-accent)';

  // Function to darken custom accent colors
  const darkenColor = (hex: string, amount: number = 0.4): string => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Darken by reducing each channel
    const newR = Math.floor(r * (1 - amount));
    const newG = Math.floor(g * (1 - amount));
    const newB = Math.floor(b * (1 - amount));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // Dynamic styles - follow same pattern as Button matte variant
  let cardStyle = {};
  let textColorClass = "";
  let borderClass = "";
  let patternColorClass = "";

  if (isCustomAccent && profile?.accent_color) {
    // Custom accent: Use darkened color with white text
    const darkenedAccent = darkenColor(profile.accent_color);
    cardStyle = { backgroundColor: darkenedAccent };
    textColorClass = "text-white";
    borderClass = "border-transparent";
    patternColorClass = "text-white";
  } else {
    // Default accent: Use CSS variables (like matte button)
    // Light mode: --color-accent is dark (#18181b), so white text
    // Dark mode: --color-accent is light (#fafafa), so dark text
    cardStyle = { backgroundColor: 'var(--color-accent)' };
    textColorClass = "text-[var(--color-on-accent)]";
    borderClass = "border-[var(--color-accent)]/20";
    patternColorClass = "text-[var(--color-on-accent)]";
  }

  const labelColorClass = isCustomAccent ? 'text-white/80' : 'text-[var(--color-on-accent)]/60';
  const trendColorClass = isCustomAccent
    ? 'text-white'
    : (percentChange >= 0
      ? 'text-emerald-500 dark:text-emerald-600'
      : 'text-rose-500 dark:text-rose-600');
  const vsTextColorClass = isCustomAccent ? 'text-white/70' : 'text-[var(--color-on-accent)]/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5 }}
      style={cardStyle}
      className={`relative overflow-hidden rounded-3xl border ${borderClass} p-6 h-full flex flex-col justify-between ${textColorClass}`}
    >
      {/* Simple Swirly Background Design */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Subtle Ambient Glow */}
        <div className={`absolute top-0 right-0 w-[400px] h-[400px] blur-[100px] rounded-full transform translate-x-1/3 -translate-y-1/3 ${isCustomAccent ? 'bg-white opacity-20' : 'bg-[var(--color-on-accent)] opacity-15'}`} />

        {/* Simple Swirly SVG Pattern */}
        <svg className={`absolute inset-0 w-full h-full ${patternColorClass}`} viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Elegant flowing S-curves */}
          <path d="M0,100 C100,50 150,150 250,100 S350,50 400,100" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25" />
          <path d="M0,120 C100,70 150,170 250,120 S350,70 400,120" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />

          {/* Gentle wave at bottom */}
          <path d="M0,160 Q100,140 200,160 T400,160" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15" />
        </svg>
      </div>

      <div className="relative z-10">
        <h3 className={`text-sm font-medium mb-1 ${labelColorClass}`}>Total Net Worth</h3>
        <div className="text-4xl md:text-5xl font-bold tracking-tighter">
          <AnimatedCounter value={netWorthValue} />
        </div>
      </div>

      {/* Trend at the bottom */}
      <div className="relative z-10 flex items-center gap-3 mt-4">
        <div className={`flex items-center gap-1 font-bold text-sm ${trendColorClass}`}>
          {percentChange >= 0 ? <FiTrendingUp className="w-4 h-4" /> : <FiTrendingDown className="w-4 h-4" />}
          <span>{Math.abs(percentChange).toFixed(1)}%</span>
        </div>
        <span className={`text-xs font-medium ${vsTextColorClass}`}>vs last month</span>
      </div>
    </motion.div>
  );
}
