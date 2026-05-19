import Link from "next/link";
import { ENDPOINTS } from "@zervo/api-spec";

export const metadata = {
  title: "API Reference",
};

export default function ApiIndexPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-10">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
          API Reference
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Public developer APIs by Zervo.
        </p>
      </header>

      <ul className="divide-y divide-zinc-100 border-t border-b border-zinc-100">
        {ENDPOINTS.map((e) => (
          <li key={e.id}>
            <Link
              href={`/docs/api/${e.id}`}
              className="block py-4 group -mx-3 px-3 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-emerald-700">
                  {e.method}
                </span>
                <code className="text-sm text-zinc-900 font-mono">{e.path}</code>
                <span className="ml-auto text-[11px] text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  ›
                </span>
              </div>
              <div className="text-sm font-medium text-zinc-900">{e.summary}</div>
              {e.description && (
                <p className="text-xs text-zinc-500 leading-relaxed mt-1 line-clamp-2">
                  {e.description}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
