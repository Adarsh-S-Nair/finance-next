import Link from "next/link";
import type { ApiEndpoint } from "@zervo/api-spec";
import { MethodBadge } from "./endpoint-primitives";

/**
 * Index listing rendered on /docs and /playground. Each row links into
 * the per-endpoint detail page on the same surface.
 */
export default function EndpointList({
  endpoints,
  hrefFor,
}: {
  endpoints: readonly ApiEndpoint[];
  hrefFor: (e: ApiEndpoint) => string;
}) {
  if (endpoints.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No endpoints yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
      {endpoints.map((e) => (
        <li key={e.id}>
          <Link
            href={hrefFor(e)}
            className="block py-4 group hover:bg-[var(--color-fg)]/[0.02] -mx-3 px-3 transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-1">
              <MethodBadge method={e.method} />
              <code className="text-sm text-[var(--color-fg)] font-mono">
                {e.path}
              </code>
              <span className="ml-auto text-[11px] text-[var(--color-muted)]/60 group-hover:text-[var(--color-muted)] transition-colors">
                ›
              </span>
            </div>
            <div className="text-sm font-medium text-[var(--color-fg)]">
              {e.summary}
            </div>
            {e.description && (
              <p className="text-xs text-[var(--color-muted)] leading-relaxed mt-1 line-clamp-2">
                {e.description}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
