import { type LegalDocument, formatEffectiveDate } from '../../lib/legal';

/**
 * Renders a LegalDocument (terms or privacy) as server-side HTML.
 * Tailwind handles typography directly — no @tailwindcss/typography
 * needed. The markdown source is trusted (we control the files), so
 * dangerouslySetInnerHTML is safe here.
 */
export default function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="max-w-2xl">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">{doc.title}</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>Effective {formatEffectiveDate(doc.effectiveDate)}</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-zinc-300" />
          <span>Version {doc.version}</span>
        </div>
      </header>
      <div
        className="legal-prose text-zinc-600 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
    </article>
  );
}
