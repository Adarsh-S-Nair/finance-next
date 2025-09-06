"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

export default function RouteTransition({ children }) {
  const pathname = usePathname();
  const first = useRef(true);
  const prev = useRef(pathname);
  const dir = useRef(1);
  const visibilityPaused = useRef(false);

  const isAdminRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/devices") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/items") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/accounts") ||
    pathname.startsWith("/budgets") ||
    pathname.startsWith("/investments") ||
    pathname.startsWith("/staff");

  useEffect(() => {
    first.current = false;
  }, []);

  useEffect(() => {
    if (prev.current) {
      // Flip direction mapping to match desired UX:
      // navigating away from root slides in from the RIGHT (positive x),
      // navigating back to root slides in from the LEFT (negative x)
      dir.current = pathname === "/" ? 1 : -1;
    }
    prev.current = pathname;
  }, [pathname]);

  // Avoid animation glitches when tab visibility changes
  useEffect(() => {
    const onVisibility = () => {
      visibilityPaused.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (isAdminRoute) {
    return (
      <div className="route-transition" suppressHydrationWarning={true}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={pathname}
      initial={first.current || visibilityPaused.current ? false : { x: 48 * dir.current }}
      animate={{ x: 0 }}
      transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
      className="route-transition"
      suppressHydrationWarning
    >
      {children}
    </motion.div>
  );
}


