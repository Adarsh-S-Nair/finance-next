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

export default function EndpointPlayground({ endpoint }: { endpoint: ApiEndpoint }) {
  const params = endpoint.parameters ?? [];

  const [values, setValues] = useState<ParamValues>(() => initialValues(params));
  const [response, setResponse] = useState<
    | { status: number; ok: boolean; bodyText: string; isJson: boolean }
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
      let isJson = false;
      try {
        const parsed = JSON.parse(bodyText);
        isJson = true;
        setResponse({
          status: res.status,
          ok: res.ok,
          bodyText: JSON.stringify(parsed, null, 2),
          isJson,
        });
      } catch {
        setResponse({ status: res.status, ok: res.ok, bodyText, isJson: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="space-y-10">
      <header className="space-y-3">
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
          <p className="text-sm text-[var(--color-muted)] leading-relaxed max-w-prose">
            {endpoint.description}
          </p>
        )}
      </header>

      <Section title="Try it">
        <div className="rounded-lg border border-[var(--color-fg)]/[0.08] divide-y divide-[var(--color-fg)]/[0.06]">
          {params.length > 0 ? (
            <div className="p-5 space-y-4">
              {params.map((p) => (
                <ParamInput
                  key={p.name}
                  param={p}
                  value={values[p.name] ?? ""}
                  onChange={(v) => setValues({ ...values, [p.name]: v })}
                />
              ))}
            </div>
          ) : (
            <div className="p-5 text-xs text-[var(--color-muted)]">
              This endpoint takes no parameters.
            </div>
          )}
          <div className="flex items-center justify-between gap-3 p-5">
            <code className="text-[11px] text-[var(--color-muted)] font-mono truncate flex-1 min-w-0">
              {fullUrl}
            </code>
            <Button onClick={handleSend} loading={sending}>
              Send
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.06] px-3 py-2 text-xs text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {response && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill status={response.status} ok={response.ok} />
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/70">
                Response
              </span>
            </div>
            <CodeBlock code={response.bodyText} />
          </div>
        )}
      </Section>

      {params.length > 0 && (
        <Section title="Parameters">
          <ParamTable params={params} />
        </Section>
      )}

      <Section title="Response">
        {endpoint.responses.map((r) => (
          <div key={r.status} className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusPill status={r.status} ok={r.status < 400} />
              <span className="text-xs text-[var(--color-muted)]">{r.description}</span>
            </div>
            <CodeBlock code={JSON.stringify(r.example, null, 2)} />
          </div>
        ))}
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
      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
      : method === "POST"
        ? "text-sky-700 bg-sky-500/10 dark:text-sky-300"
        : method === "DELETE"
          ? "text-rose-700 bg-rose-500/10 dark:text-rose-300"
          : "text-amber-700 bg-amber-500/10 dark:text-amber-300";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider",
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
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        ok
          ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
          : "text-rose-700 bg-rose-500/10 dark:text-rose-300",
      )}
    >
      {status}
    </span>
  );
}

function ParamInput({
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
      <label htmlFor={inputId} className="flex items-start gap-3 cursor-pointer">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <ParamLabel param={param} />
          <p className="text-xs text-[var(--color-muted)] leading-relaxed mt-1">
            {param.description}
          </p>
        </div>
      </label>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block">
        <ParamLabel param={param} />
      </label>
      <input
        id={inputId}
        type={param.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          param.default !== undefined ? String(param.default) : undefined
        }
        className="w-full rounded border border-[var(--color-fg)]/[0.12] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-mono text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]/[0.3]"
      />
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        {param.description}
      </p>
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
      <span
        className={clsx(
          "text-[10px] uppercase tracking-[0.08em]",
          param.required
            ? "text-[var(--color-danger)]/80 font-medium"
            : "text-[var(--color-muted)]/60",
        )}
      >
        {param.required ? "required" : "optional"}
      </span>
    </span>
  );
}

function ParamTable({ params }: { params: ApiParameter[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-fg)]/[0.08] divide-y divide-[var(--color-fg)]/[0.06]">
      {params.map((p) => (
        <div key={p.name} className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <ParamLabel param={p} />
            {p.default !== undefined && (
              <span className="text-[11px] text-[var(--color-muted)]/80 font-mono">
                default: {String(p.default)}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed mt-1.5">
            {p.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="rounded-md bg-[var(--color-fg)]/[0.04] border border-[var(--color-fg)]/[0.06] px-4 py-3 text-[12px] font-mono text-[var(--color-fg)] overflow-x-auto leading-relaxed">
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
  // Replace path params (e.g. /things/{id}) with the value, then append query string.
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
  return `import { request } from "node:https";\n\nconst res = await fetch("${url}");\nconsole.log(await res.json());`;
}
