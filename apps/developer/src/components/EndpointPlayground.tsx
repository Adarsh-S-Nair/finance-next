"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { LuCheck, LuCopy } from "react-icons/lu";
import { Button, Drawer, SegmentedTabs, type SegmentedTabOption } from "@zervo/ui";
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
 * Documentation surface for one API endpoint.
 *
 * The page itself is read-only docs: parameters on the left, an example
 * response on the right, and code samples beneath. Hitting "Try it"
 * opens a right-side drawer with the interactive form — that keeps the
 * docs page calm and uncluttered, and gives the playground full focus
 * when the user actually wants to execute a request.
 */
export default function EndpointPlayground({ endpoint }: { endpoint: ApiEndpoint }) {
  const params = useMemo(() => endpoint.parameters ?? [], [endpoint.parameters]);
  const [tryOpen, setTryOpen] = useState(false);
  const [lang, setLang] = useState<CodeLang>("curl");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://developer.zervo.app";

  const exampleValues = useMemo(() => initialValues(params), [params]);
  const exampleCode = useMemo(
    () => codeSample(lang, endpoint, exampleValues, origin),
    [lang, endpoint, exampleValues, origin],
  );

  return (
    <article className="space-y-12">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-3 max-w-prose min-w-0">
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
        </div>
        <Button onClick={() => setTryOpen(true)} size="sm" variant="primary">
          Try it
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
        <Section title="Parameters">
          {params.length > 0 ? (
            <div className="space-y-6">
              {params.map((p) => (
                <ParamDocRow key={p.name} param={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">No parameters.</p>
          )}
        </Section>

        <Section title="Response">
          <div className="space-y-6">
            {endpoint.responses.map((r) => (
              <div key={r.status} className="space-y-2">
                {r.description && (
                  <p className="text-xs text-[var(--color-muted)]">{r.description}</p>
                )}
                <CodeBlock
                  code={JSON.stringify(r.example, null, 2)}
                  cornerBadge={<StatusBadge status={r.status} />}
                />
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Code">
        <SegmentedTabs
          options={CODE_LANGS}
          value={lang}
          onChange={(v) => setLang(v as CodeLang)}
          size="sm"
        />
        <div className="mt-3">
          <CodeBlock code={exampleCode} />
        </div>
      </Section>

      <TryItDrawer
        endpoint={endpoint}
        origin={origin}
        isOpen={tryOpen}
        onClose={() => setTryOpen(false)}
      />
    </article>
  );
}

function TryItDrawer({
  endpoint,
  origin,
  isOpen,
  onClose,
}: {
  endpoint: ApiEndpoint;
  origin: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const params = endpoint.parameters ?? [];

  const [values, setValues] = useState<ParamValues>(() => initialValues(params));
  const [response, setResponse] = useState<
    { status: number; ok: boolean; bodyText: string } | null
  >(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={endpoint.summary}
      description={`${endpoint.method} ${endpoint.path}`}
      size="lg"
    >
      <div className="space-y-8">
        {params.length > 0 ? (
          <div className="space-y-6">
            {params.map((p) => (
              <ParamInputRow
                key={p.name}
                param={p}
                value={values[p.name] ?? ""}
                onChange={(v) => setValues({ ...values, [p.name]: v })}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">This endpoint takes no parameters.</p>
        )}

        <div className="pt-4 border-t border-[var(--color-fg)]/[0.06] flex items-center gap-3">
          <code className="text-[11px] text-[var(--color-muted)] font-mono truncate flex-1 min-w-0">
            {fullUrl}
          </code>
          <Button onClick={handleSend} loading={sending} size="sm">
            Send
          </Button>
        </div>

        {error && (
          <p className="text-xs text-[var(--color-danger)]">{error}</p>
        )}

        {response && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
              Response
            </h3>
            <CodeBlock
              code={response.bodyText}
              cornerBadge={<StatusBadge status={response.status} />}
            />
          </div>
        )}
      </div>
    </Drawer>
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
    <span className={clsx("text-[10px] font-semibold tracking-[0.12em]", color)}>
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
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

function ParamMeta({ param }: { param: ApiParameter }) {
  const parts: string[] = [param.type];
  parts.push(param.required ? "required" : "optional");
  if (param.default !== undefined) parts.push(`default ${String(param.default)}`);
  return (
    <span className="text-xs text-[var(--color-muted)]/80">
      {parts.join(" · ")}
    </span>
  );
}

function ParamDocRow({ param }: { param: ApiParameter }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <code className="text-sm font-mono font-medium text-[var(--color-fg)]">
          {param.name}
        </code>
        <ParamMeta param={param} />
      </div>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        {param.description}
      </p>
    </div>
  );
}

function ParamInputRow({
  param,
  value,
  onChange,
}: {
  param: ApiParameter;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputId = `try-${param.name}`;

  if (param.type === "boolean") {
    const checked = value === "true";
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <code className="text-sm font-mono font-medium text-[var(--color-fg)]">
            {param.name}
          </code>
          <ParamMeta param={param} />
        </div>
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
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
          {param.description}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block">
        <div className="flex items-baseline gap-2 flex-wrap">
          <code className="text-sm font-mono font-medium text-[var(--color-fg)]">
            {param.name}
          </code>
          <ParamMeta param={param} />
        </div>
      </label>
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
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        {param.description}
      </p>
    </div>
  );
}

function CodeBlock({
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
