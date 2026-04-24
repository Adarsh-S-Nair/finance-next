"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Global TanStack Query client — drives the stale-while-revalidate
 * caching behind every useQuery call in the app.
 *
 * Defaults chosen for a finance dashboard where:
 *   - Returning to a page within ~30s should show cached data
 *     instantly instead of flashing skeletons.
 *   - After 30s, cached data shows immediately AND a background
 *     refetch runs so numbers stay fresh.
 *   - Unused data lingers in memory for ~5 minutes (gcTime) so
 *     switching away and back is also an instant hit.
 *   - Refetch-on-window-focus is off; users don't expect their
 *     balances to re-animate every time they tab back.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  // Lazy-init the client once per browser session. Using useState here
  // (instead of a module-level singleton) avoids accidentally sharing
  // the same client across users during SSR hot-reload in dev.
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
