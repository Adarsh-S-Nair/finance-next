/**
 * Per-group loading UI. Renders instantly on client-side navigation while
 * the next page resolves its server data, so switching tabs never looks
 * frozen — the shell (sidebar, profile bar) stays mounted via the group
 * layout and only this body is swapped out.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-10">
        <div className="h-7 w-40 rounded bg-[var(--color-fg)]/[0.06]" />
        <div className="mt-3 h-4 w-64 rounded bg-[var(--color-fg)]/[0.04]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-8 mb-14">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-16 rounded bg-[var(--color-fg)]/[0.05]" />
            <div className="mt-2 h-8 w-20 rounded bg-[var(--color-fg)]/[0.07]" />
            <div className="mt-2 h-3 w-24 rounded bg-[var(--color-fg)]/[0.04]" />
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-fg)]/[0.06]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-4 border-b border-[var(--color-fg)]/[0.06]">
            <div className="h-10 w-10 rounded-full bg-[var(--color-fg)]/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-[var(--color-fg)]/[0.06]" />
              <div className="h-3 w-56 rounded bg-[var(--color-fg)]/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
