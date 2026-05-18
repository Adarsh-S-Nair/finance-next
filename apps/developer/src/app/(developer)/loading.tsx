/**
 * Per-group loading UI. Renders instantly on client-side navigation while
 * the next page resolves its server data.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-10">
        <div className="h-7 w-40 rounded bg-[var(--color-fg)]/[0.06]" />
        <div className="mt-3 h-4 w-64 rounded bg-[var(--color-fg)]/[0.04]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-[var(--color-fg)]/[0.06] p-5 space-y-3">
            <div className="h-4 w-32 rounded bg-[var(--color-fg)]/[0.06]" />
            <div className="h-3 w-full rounded bg-[var(--color-fg)]/[0.04]" />
            <div className="h-3 w-3/4 rounded bg-[var(--color-fg)]/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
