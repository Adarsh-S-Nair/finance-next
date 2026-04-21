"use client";

import { createContext, useContext } from "react";

export const InvestmentsHeaderContext = createContext(null);

export function useInvestmentsHeader() {
  const context = useContext(InvestmentsHeaderContext);
  return context || { setHeaderActions: null };
}

