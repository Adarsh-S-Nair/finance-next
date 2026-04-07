"use client";

export default function RouteTransition({ children }) {
  return (
    <div className="route-transition" suppressHydrationWarning={true}>
      {children}
    </div>
  );
}
