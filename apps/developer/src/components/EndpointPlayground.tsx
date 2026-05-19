"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@zervo/ui";
import type { ApiEndpoint, ApiParameter } from "@/lib/api-registry";
import {
  CodeBlock,
  MethodBadge,
  ParamMeta,
  Section,
  StatusBadge,
  buildFullUrl,
  initialValues,
  type ParamValues,
} from "./endpoint-primitives";

/**
 * Full-page interactive playground for one endpoint. Left column is the
 * request (inputs + URL preview + Send), right column is the response
 * (live result after Send; placeholder otherwise). The "View docs" CTA
 * in the header sends the user back to /docs/[id] for the read-only
 * reference.
 */
export default function EndpointPlayground({ endpoint }: { endpoint: ApiEndpoint }) {
  const params = useMemo(() => endpoint.parameters ?? [], [endpoint.parameters]);

  const [values, setValues] = useState<ParamValues>(() => initialValues(params));
  const [response, setResponse] = useState<
    { status: number; ok: boolean; bodyText: string } | null
  >(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        </div>
        <Link href={`/docs/${endpoint.id}`}>
          <Button size="sm" variant="outline">
            View docs
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
        {/* LEFT — Request */}
        <Section title="Request">
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
            <p className="text-xs text-[var(--color-muted)]">
              This endpoint takes no parameters.
            </p>
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

        {/* RIGHT — Response */}
        <Section title="Response">
          {error && (
            <p className="text-xs text-[var(--color-danger)]">{error}</p>
          )}

          {!error && !response && (
            <p className="text-xs text-[var(--color-muted)]/70">
              Hit Send to make the request — the response will appear here.
            </p>
          )}

          {response && (
            <CodeBlock
              code={response.bodyText}
              cornerBadge={<StatusBadge status={response.status} />}
            />
          )}
        </Section>
      </div>
    </article>
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
