"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, SegmentedTabs, type SegmentedTabOption } from "@zervo/ui";
import type { ApiEndpoint, ApiParameter } from "@/lib/api-registry";
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

const CODE_LANGS: SegmentedTabOption[] = [
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "node", label: "Node" },
];

/**
 * Read-only documentation view for one endpoint. Renders the parameter
 * reference, the canonical response example (status overlaid in the
 * bottom-right of the JSON block), and code samples using the
 * registry's example values. The "Try it" CTA in the header sends the
 * user to /playground/[id] where the same endpoint becomes interactive.
 */
export default function EndpointDocs({ endpoint }: { endpoint: ApiEndpoint }) {
  const params = useMemo(() => endpoint.parameters ?? [], [endpoint.parameters]);
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
        <Link href={`/playground/${endpoint.id}`}>
          <Button size="sm" variant="primary">
            Try it
          </Button>
        </Link>
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
    </article>
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
