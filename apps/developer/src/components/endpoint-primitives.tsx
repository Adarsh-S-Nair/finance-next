"use client";

import { useState } from "react";
import clsx from "clsx";
import { LuCheck, LuCopy } from "react-icons/lu";
import type {
  ApiEndpoint,
  ApiParameter,
  HttpMethod,
} from "@/lib/api-registry";

export type ParamValues = Record<string, string>;
export type CodeLang = "curl" | "fetch" | "node";

/**
 * Small UI bits shared between the docs view and the playground view —
 * extracted so the two surfaces render the same method badge, status
 * pill, code block, and parameter metadata strip. URL + code-sample
 * helpers also live here so both surfaces derive request representations
 * identically from the registry.
 */

export function MethodBadge({ method }: { method: HttpMethod }) {
  const color =
    method === "GET"
      ? "text-emerald-700 dark:text-emerald-300"
      : method === "POST"
        ? "text-sky-700 dark:text-sky-300"
        : method === "DELETE"
          ? "text-rose-700 dark:text-rose-300"
          : "text-amber-700 dark:text-amber-300";
  return (
    <span className={clsx("text-[10px] font-semibold tracking-[0.12em]", color)}>
      {method}
    </span>
  );
}

export function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={clsx(
        "text-[11px] font-semibold tabular-nums",
        status < 400
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-rose-700 dark:text-rose-300",
      )}
    >
      {status}
    </span>
  );
}

export function ParamMeta({ param }: { param: ApiParameter }) {
  const parts: string[] = [param.type];
  parts.push(param.required ? "required" : "optional");
  if (param.default !== undefined) parts.push(`default ${String(param.default)}`);
  return (
    <span className="text-xs text-[var(--color-muted)]/80">
      {parts.join(" · ")}
    </span>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CodeBlock({
  code,
  cornerBadge,
}: {
  code: string;
  cornerBadge?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre
        className={clsx(
          "rounded bg-[var(--color-fg)]/[0.04] px-4 py-3 text-[12px] font-mono text-[var(--color-fg)] overflow-x-auto leading-relaxed",
          cornerBadge && "pb-7",
        )}
      >
        {code}
      </pre>
      {cornerBadge && (
        <span className="absolute bottom-2 right-3 pointer-events-none">
          {cornerBadge}
        </span>
      )}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* clipboard may be blocked; silently no-op */
          }
        }}
        className="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy"
      >
        {copied ? (
          <LuCheck className="h-3.5 w-3.5 text-[var(--color-success)]" />
        ) : (
          <LuCopy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function initialValues(params: ApiParameter[]): ParamValues {
  const out: ParamValues = {};
  for (const p of params) {
    const initial = p.example ?? p.default ?? "";
    out[p.name] = String(initial);
  }
  return out;
}

export function buildFullUrl(
  endpoint: ApiEndpoint,
  values: ParamValues,
  origin: string,
): string {
  let path = endpoint.path;
  for (const p of endpoint.parameters ?? []) {
    if (p.in === "path") {
      path = path.replace(`{${p.name}}`, encodeURIComponent(values[p.name] ?? ""));
    }
  }
  const query = (endpoint.parameters ?? [])
    .filter((p) => p.in === "query")
    .map((p) => [p, values[p.name]] as const)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([p, v]) => `${encodeURIComponent(p.name)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${origin}${path}${query ? `?${query}` : ""}`;
}

export function codeSample(
  lang: CodeLang,
  endpoint: ApiEndpoint,
  values: ParamValues,
  origin: string,
): string {
  const url = buildFullUrl(endpoint, values, origin);
  if (lang === "curl") {
    const m = endpoint.method === "GET" ? "" : `-X ${endpoint.method} `;
    return `curl ${m}'${url}'`;
  }
  if (lang === "fetch") {
    return `const res = await fetch("${url}");\nconst data = await res.json();\nconsole.log(data);`;
  }
  // node
  return `const res = await fetch("${url}");\nconst data = await res.json();\nconsole.log(data);`;
}
