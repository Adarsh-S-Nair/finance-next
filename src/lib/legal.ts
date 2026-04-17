import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { BRAND } from '../config/brand';

export interface LegalDocument {
  slug: 'terms' | 'privacy';
  title: string;
  version: string;
  effectiveDate: string;
  summary?: string;
  html: string;
}

interface FrontMatter {
  title: string;
  version: string;
  effective_date: string;
  summary?: string;
}

const CONTENT_DIR = join(process.cwd(), 'content', 'legal');

/**
 * Substitute {{brandName}} / {{supportEmail}} / {{legalName}} placeholders
 * with the current brand constants. Run on raw markdown before parsing so
 * substitutions work inside links, emphasis, and structural elements.
 */
function applyBrandTokens(raw: string): string {
  return raw
    .replaceAll('{{brandName}}', BRAND.name)
    .replaceAll('{{supportEmail}}', BRAND.supportEmail)
    .replaceAll('{{legalName}}', BRAND.legalName)
    .replaceAll('{{domain}}', BRAND.domain);
}

export function loadLegalDocument(
  slug: 'terms' | 'privacy',
): LegalDocument {
  const filePath = join(CONTENT_DIR, `${slug}.md`);
  const raw = readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const fm = parsed.data as FrontMatter;
  const body = applyBrandTokens(parsed.content);
  const html = marked.parse(body, { async: false }) as string;

  return {
    slug,
    title: fm.title,
    version: fm.version,
    effectiveDate: fm.effective_date,
    summary: fm.summary ? applyBrandTokens(fm.summary) : undefined,
    html,
  };
}

/**
 * Format an ISO date as "Month Day, Year" — e.g. "April 17, 2026".
 * Formatting at render time keeps the markdown portable and avoids
 * locale-specific strings in the content file.
 */
export function formatEffectiveDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
