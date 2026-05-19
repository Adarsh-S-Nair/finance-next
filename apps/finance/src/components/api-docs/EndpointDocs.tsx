"use client";

import { useMemo, useState } from "react";
import type { ApiEndpoint, ApiParameter } from "@zervo/api-spec";
import {
  CodeBlock,
  MethodBadge,
  ParamMeta,
  Section,
  StatusBadge,
  codeSample,
  initialValues,
  type CodeLang,
} from "./endpoint-primitives";

const CODE_LANGS: { value: CodeLang; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "node", label: "Node" },
];

/**
 * Public-facing reference doc for one API endpoint.
 *
 * Two-column layout: prose on the left (description + parameters),
 * machine-readable on the right (code samples + response example).
 * Matches the visual rhythm of major API docs (Stripe / Resend) — the
 * left tells you what it does, the right tells you what to send and
 * what comes back.
 */
export default function EndpointDocs({
  endpoint,
  developerOrigin,
}: {
  endpoint: ApiEndpoint;
  /** Origin used in URL previews / code samples. Defaults to prod. */
  developerOrigin?: string;
}) {
  const params = useMemo(() => endpoint.parameters ?? [], [endpoint.parameters]);
  const [lang, setLang] = useState<CodeLang>("curl");

  const origin = developerOrigin ?? "https://developer.zervo.app";
  const exampleValues = useMemo(() => initialValues(params), [params]);
  const exampleCode = useMemo(
    () => codeSample(lang, endpoint, exampleValues, origin),
    [lang, endpoint, exampleValues, origin],
  );

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2.5">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm text-zinc-900 font-mono">{endpoint.path}</code>
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
          {endpoint.summary}
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-x-14 gap-y-10">
        {/* LEFT — description + parameters */}
        <div className="space-y-10 min-w-0">
          {endpoint.description && (
            <p className="text-sm text-zinc-600 leading-relaxed max-w-prose">
              {endpoint.description}
            </p>
          )}

          <Section title="Parameters">
            {params.length > 0 ? (
              <div className="space-y-6">
                {params.map((p) => (
                  <ParamDocRow key={p.name} param={p} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No parameters.</p>
            )}
          </Section>
        </div>

        {/* RIGHT — request code samples + response example (sticky on lg+) */}
        <div className="space-y-8 min-w-0 lg:sticky lg:top-28 lg:self-start">
          <Section title="Request">
            <div
              role="radiogroup"
              aria-label="Language"
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1 mb-3"
            >
              {CODE_LANGS.map((l) => {
                const active = l.value === lang;
                return (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLang(l.value)}
                    className={
                      active
                        ? "px-3 py-1 rounded-full text-xs font-medium bg-white text-zinc-900 shadow-sm"
                        : "px-3 py-1 rounded-full text-xs text-zinc-500 hover:text-zinc-900"
                    }
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
            <CodeBlock code={exampleCode} />
          </Section>

          <Section title="Response">
            <div className="space-y-6">
              {endpoint.responses.map((r) => (
                <div key={r.status} className="space-y-2">
                  {r.description && (
                    <p className="text-xs text-zinc-500">{r.description}</p>
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
      </div>
    </article>
  );
}

function ParamDocRow({ param }: { param: ApiParameter }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <code className="text-sm font-mono font-medium text-zinc-900">
          {param.name}
        </code>
        <ParamMeta param={param} />
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed">{param.description}</p>
    </div>
  );
}
