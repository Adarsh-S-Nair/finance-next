"use client";

import { useEffect } from 'react';

export default function DebugFetchMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__debugFetchPatched) return;
    window.__debugFetchPatched = true;
    window.__debugFetchStats = window.__debugFetchStats || { byPath: {}, totalBytes: 0, totalCount: 0 };

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const start = Date.now();
      let urlString = typeof input === 'string' ? input : (input && input.url) || '';
      try {
        const res = await origFetch(input, init);
        // Only track same-origin API calls to avoid heavy cross-origin bodies
        const url = new URL(urlString, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
          try {
            const clone = res.clone();
            const buf = await clone.arrayBuffer();
            const bytes = buf.byteLength || 0;
            const key = url.pathname + (url.search ? '?' + url.search : '');
            const stats = window.__debugFetchStats;
            stats.totalBytes += bytes;
            stats.totalCount += 1;
            if (!stats.byPath[key]) stats.byPath[key] = { count: 0, bytes: 0, lastMs: 0 };
            stats.byPath[key].count += 1;
            stats.byPath[key].bytes += bytes;
            stats.byPath[key].lastMs = Date.now() - start;
          } catch (_) {
            // ignore measuring failures
          }
        }
        return res;
      } catch (e) {
        throw e;
      }
    };
  }, []);

  return null;
}






