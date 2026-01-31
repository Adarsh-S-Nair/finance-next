"use client";

import { createContext, useContext } from "react";

export const PaperTradingHeaderContext = createContext(null);

export function usePaperTradingHeader() {
  const context = useContext(PaperTradingHeaderContext);
  return context || { setHeaderActions: null };
}
