"use client";

import React, { createContext, useContext, useState } from 'react';

const NetWorthHoverContext = createContext();

export function useNetWorthHover() {
  const context = useContext(NetWorthHoverContext);
  if (!context) {
    throw new Error('useNetWorthHover must be used within a NetWorthHoverProvider');
  }
  return context;
}

export function NetWorthHoverProvider({ children }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [isHovering, setIsHovering] = useState(false);

  const setHoverData = (data) => {
    setHoveredData(data);
    setIsHovering(true);
  };

  const clearHoverData = () => {
    setHoveredData(null);
    setIsHovering(false);
  };

  const value = {
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
