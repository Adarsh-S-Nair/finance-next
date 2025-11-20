"use client";

import { useEffect, useState } from 'react';

export default function DebugMemoryStats() {
  const [server, setServer] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  const toMB = (n: number) => Math.round((n / (1024 * 1024)) * 100) / 100;

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await fetch('/api/debug/memory', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (mounted) setServer(json);
        }
      } catch (e) {
        // console.error(e);
      }

      if (typeof window !== 'undefined' && performance && (performance as any).memory) {
        const { usedJSHeapSize, totalJSHeapSize } = (performance as any).memory;
        if (mounted) setClient({ usedMB: toMB(usedJSHeapSize), totalMB: toMB(totalJSHeapSize) });
      }
    };

    poll();
    intervalId = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, []);

  if (!server && !client) return null;

  return (
    <div className="hidden md:flex items-center gap-3 text-xs font-mono mr-2">
      {server?.summary && (
        <>
          <span title="Server RSS" className="text-emerald-600 dark:text-emerald-400">
            RSS:{server.summary.rssMB}M
          </span>
          <span title="Server Heap Used" className="text-sky-600 dark:text-sky-400">
            SHeap:{server.summary.heapUsedMB}M
          </span>
        </>
      )}
      {client && (
        <span title="Client JS Heap" className="text-amber-600 dark:text-amber-400">
          CHeap:{client.usedMB}M
        </span>
      )}
    </div>
  );
}

