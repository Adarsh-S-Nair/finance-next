"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { authFetch } from "./fetch";

/**
 * Thin wrapper over useQuery that:
 *   - Calls authFetch under the hood (so the session JWT goes along).
 *   - Treats any non-2xx response as a query error instead of silently
 *     returning the parsed body (which was the old fetch-in-useEffect
 *     pattern's biggest foot-gun).
 *
 * Use this wherever a card/page needs authenticated JSON data and
 * wants the free stale-while-revalidate + dedupe + cross-mount cache
 * that the global QueryClient provides. On remount within staleTime
 * the cached data is returned synchronously — no skeleton flash.
 */
export function useAuthedQuery<T>(
  key: unknown[],
  url: string | null,
  options?: Omit<UseQueryOptions<T, Error, T, unknown[]>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error, T, unknown[]>({
    queryKey: key,
    enabled: url != null && options?.enabled !== false,
    queryFn: async ({ signal }) => {
      if (!url) throw new Error("missing url");
      const res = await authFetch(url, { signal });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
      }
      return (await res.json()) as T;
    },
    ...options,
  });
}
