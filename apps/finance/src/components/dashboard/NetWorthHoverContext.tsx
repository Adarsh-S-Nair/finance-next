"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Payload pushed by the net-worth chart while the user scrubs it.
 * `categorizedBalances` keys mirror the account categorization used by
 * AccountsSummaryCard (cash / investments / credit / loans / other).
 */
export interface NetWorthHoverData {
  assets?: number;
  liabilities?: number;
  netWorth?: number;
  date?: string;
  categorizedBalances?: Record<string, number> | null;
}

interface NetWorthHoverContextValue {
  hoveredData: NetWorthHoverData | null;
  isHovering: boolean;
  setHoverData: (data: NetWorthHoverData) => void;
  clearHoverData: () => void;
}

const NetWorthHoverContext = createContext<NetWorthHoverContextValue | undefined>(undefined);

export function useNetWorthHover(): NetWorthHoverContextValue {
  const context = useContext(NetWorthHoverContext);
  if (!context) {
    throw new Error('useNetWorthHover must be used within a NetWorthHoverProvider');
  }
  return context;
}

export function NetWorthHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredData, setHoveredData] = useState<NetWorthHoverData | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const setHoverData = (data: NetWorthHoverData) => {
    setHoveredData(data);
    setIsHovering(true);
  };

  const clearHoverData = () => {
    setHoveredData(null);
    setIsHovering(false);
  };

  const value: NetWorthHoverContextValue = {
    hoveredData,
    isHovering,
    setHoverData,
    clearHoverData
  };

  return (
    <NetWorthHoverContext.Provider value={value}>
      {children}
    </NetWorthHoverContext.Provider>
  );
}
