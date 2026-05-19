"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { LuCheck, LuCopy } from "react-icons/lu";
import { Button, SegmentedTabs, type SegmentedTabOption } from "@zervo/ui";
import type {
  ApiEndpoint,
  ApiParameter,
  HttpMethod,
} from "@/lib/api-registry";

type ParamValues = Record<string, string>;
type CodeLang = "curl" | "fetch" | "node";

const CODE_LANGS: SegmentedTabOption[] = [
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "node", label: "Node" },
];

/**
 * Two-column playground for one API endpoint.
 *
 * LEFT  = everything you _send_ — inputs (with inline docs), URL preview +
 *         Send, and code samples in the language of your choice.
 * RIGHT = everything you _get back_ — the live response if you've hit Send,
 *         plus the canonical example for reference.
 *
 * Everything is driven by the endpoint entry passed in; the playground
 * itself knows nothing about specific endpoints. Adding the next endpoint
 * is a registry edit + a route handler, no UI work.
 */
export default function EndpointPlayground({ endpoint }: { endpoint: ApiEndpoint }) {
  const params = endpoint.parameters ?? [];

  const [values, setValues] = useState<ParamValues>(() => initialValues(params));
  const [response, setResponse] = useState<
    | { status: number; ok: boolean; bodyText: string }
    | null
  >(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<CodeLang>("curl");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://developer.zervo.app";
  const fullUrl = useMemo(
    () => buildFullUrl(endpoint, values, origin),
    [endpoint, values, origin],
  );

  async function handleSend() {
    setSending(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(fullUrl, { method: endpoint.method });
      const bodyText = await res.text();
      try {
        const parsed = JSON.parse(bodyText);
        setResponse({
          status: res.status,
          ok: res.ok,
          bodyText: JSON.stringify(parsed, null, 2),
        });
      } catch {
        setResponse({ status: res.status, ok: res.ok, bodyText });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="space-y-10">
      {/* Header */}
      <header className="space-y-3 max-w-prose">
        <div className="flex items-center gap-2.5">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm text-[var(--color-fg)] font-mono">
            {endpoint.path}
          </code>
        </div>
        <h2 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          {endpoint.summary}
        </h2>
        {endpoint.description && (
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            {endpoint.description}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-12">
        {/* LEFT — Request */}
        <div className="space-y-10 min-w-0">
          <Section title="Request">
            {params.length > 0 ? (
              <div className="space-y-6">
                {params.map((p) => (
                  <ParamRow
                    key={p.name}
                    param={p}
                    value={values[p.name] ?? ""}
                    onChange={(v) => setValues({ ...values, [p.name]: v })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">No parameters.</p>
            )}

            <div className="mt-6 pt-4 border-t border-[var(--color-fg)]/[0.06] flex items-center gap-3">
              <code className="text-[11px] text-[var(--color-muted)] font-mono truncate flex-1 min-w-0">
                {fullUrl}
              </code>
              <Button onClick={handleSend} loading={sending} size="sm">
                Send
              </Button>
            </div>
          </Section>

          <Section title="Code">
            <SegmentedTabs
              options={CODE_LANGS}
              value={lang}
              onChange={(v) => setLang(v as CodeLang)}
              size="sm"
            />
            <div className="mt-3">
              <CodeBlock code={codeSample(lang, endpoint, values, origin)} />
            </div>
          </Section>
        </div>

        {/* RIGHT — Response */}
        <div className="space-y-10 min-w-0">
          {(error || response) && (
            <Section title="Latest call">
              {error && (
                <p className="text-xs text-[var(--color-danger)]">{error}</p>
              )}
              {response && (
                <div className="space-y-2">
                  <StatusPill status={response.status} ok={response.ok} />
                  <CodeBlock code={response.bodyText} />
                </div>
              )}
            </Section>
          )}

          <Section title="Example response">
            <div className="space-y-6">
              {endpoint.responses.map((r) => (
                <div key={r.status} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <StatusPill status={r.status} ok={r.status < 400} />
                    <span className="text-xs text-[var(--color-muted)]">
                      {r.description}
                    </span>
                  </div>
                  <CodeBlock code={JSON.stringify(r.example, null, 2)} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const color =
    method === "GET"
      ? "text-emerald-700 dark:text-emerald-300"
      : method === "POST"
        ? "text-sky-700 dark:text-sky-300"
        : method === "DELETE"
          ? "text-rose-700 dark:text-rose-300"
          : "text-amber-700 dark:text-amber-300";
  return (
    <span
      className={clsx(
        "text-[10px] font-semibold tracking-[0.12em]",
        color,
      )}
    >
      {method}
    </span>
  );
}

function StatusPill({ status, ok }: { status: number; ok: boolean }) {
  return (
    <span
      className={clsx(
        "text-[11px] font-semibold tabular-nums",
        ok
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-rose-700 dark:text-rose-300",
      )}
    >
      {status}
    </span>
  );
}

function ParamRow({
  param,
  value,
  onChange,
}: {
  param: ApiParameter;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputId = `param-${param.name}`;

  if (param.type === "boolean") {
    const checked = value === "true";
    return (
      <div className="space-y-1.5">
        <ParamLabel param={param} />
        <label htmlFor={inputId} className="inline-flex items-center gap-2 cursor-pointer">
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />
          <span className="text-sm font-mono text-[var(--color-fg)]">
            {checked ? "true" : "false"}
          </span>
        </label>
        <ParamHelp param={param} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId}>
          <ParamLabel param={param} />
        </label>
        {param.default !== undefined && (
          <span className="text-[11px] text-[var(--color-muted)]/70 font-mono">
            default: {String(param.default)}
          </span>
        )}
      </div>
      <input
        id={inputId}
        type={param.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          param.default !== undefined ? String(param.default) : undefined
        }
        className="w-full border-b border-[var(--color-fg)]/[0.12] bg-transparent py-1.5 text-sm font-mono text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 focus:outline-none focus:border-[var(--color-fg)]/[0.3] transition-colors"
      />
      <ParamHelp param={param} />
    </div>
  );
}

function ParamLabel({ param }: { param: ApiParameter }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <code className="text-sm font-mono text-[var(--color-fg)]">{param.name}</code>
      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)]/70">
        {param.type}
      </span>
      {param.required ? (
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-danger)]/80 font-medium">
          required
        </span>
      ) : null}
    </span>
  );
}

function ParamHelp({ param }: { param: ApiParameter }) {
  return (
    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
      {param.description}
    </p>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="rounded bg-[var(--color-fg)]/[0.04] px-4 py-3 text-[12px] font-mono text-[var(--color-fg)] overflow-x-auto leading-relaxed">
        {code}
      </pre>
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

// --- Helpers --------------------------------------------------------------

function initialValues(params: ApiParameter[]): ParamValues {
  const out: ParamValues = {};
  for (const p of params) {
    const initial = p.example ?? p.default ?? "";
    out[p.name] = String(initial);
  }
  return out;
}

function buildFullUrl(
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

function codeSample(
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
