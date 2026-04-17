#!/usr/bin/env node
/**
 * Query Axiom logs from the CLI.
 *
 * Usage:
 *   node scripts/axiom-query.mjs [--hours N] [--level LEVEL] [--context CTX]
 *                                [--search TEXT] [--limit N] [--raw]
 *
 * Examples:
 *   node scripts/axiom-query.mjs --hours 1
 *   node scripts/axiom-query.mjs --level error --hours 24
 *   node scripts/axiom-query.mjs --context transaction-sync --limit 20
 *   node scripts/axiom-query.mjs --search "Plaid" --hours 6
 *
 * Env (reads .env.development):
 *   NEXT_PUBLIC_AXIOM_DATASET  — dataset name
 *   AXIOM_QUERY_TOKEN          — query token (separate from ingest token)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^['"]|['"]$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {}
}
loadEnv(resolve(process.cwd(), '.env.development'));
loadEnv(resolve(process.cwd(), '.env.local'));

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}
function bool(name) {
  return args.includes(`--${name}`);
}

const HOURS = Number(flag('hours', '1'));
const LEVEL = flag('level');
const CONTEXT = flag('context');
const SEARCH = flag('search');
const LIMIT = Number(flag('limit', '50'));
const RAW = bool('raw');

const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET || process.env.AXIOM_DATASET;
const token = process.env.AXIOM_QUERY_TOKEN;

if (!dataset || !token) {
  console.error('Missing NEXT_PUBLIC_AXIOM_DATASET or AXIOM_QUERY_TOKEN in env.');
  process.exit(1);
}

const endTime = new Date();
const startTime = new Date(endTime.getTime() - HOURS * 3600 * 1000);

const filters = [];
if (LEVEL) filters.push(`level == "${LEVEL}"`);
if (CONTEXT) filters.push(`tostring(context) contains "${CONTEXT}" or tostring(source) contains "${CONTEXT}"`);
if (SEARCH) filters.push(`tostring(message) contains "${SEARCH}"`);

const apl = [
  `['${dataset}']`,
  filters.length ? `| where ${filters.join(' and ')}` : '',
  `| sort by _time desc`,
  `| limit ${LIMIT}`,
].filter(Boolean).join(' ');

const body = {
  apl,
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
};

const res = await fetch('https://api.axiom.co/v1/datasets/_apl?format=legacy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`Axiom API error (${res.status}):`, await res.text());
  process.exit(1);
}

const data = await res.json();
const matches = data.matches || [];

if (RAW) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

console.error(`Window: ${startTime.toISOString()} → ${endTime.toISOString()}`);
console.error(`Matched: ${data.status?.rowsMatched ?? matches.length} rows (showing ${matches.length})`);
console.error('');

if (matches.length === 0) {
  console.error('No logs in this window.');
  process.exit(0);
}

const LEVEL_NAMES = { '0': 'debug', '1': 'info', '2': 'warn', '3': 'error' };
for (const m of matches) {
  const d = m.data || {};
  const rawLevel = String(d.fields?.level ?? d.level ?? '');
  const level = (LEVEL_NAMES[rawLevel] ?? rawLevel).padEnd(5);
  const ctx = (d.fields?.context || d.context || d.source || '').padEnd(24);
  const time = m._time?.replace('T', ' ').replace('Z', '').slice(0, 19);
  const msg = d.message || '';
  const reqId = d.requestId || d.fields?.requestId;
  const extra = reqId ? ` [${reqId.slice(0, 8)}]` : '';
  const errName = d.error?.name || d.fields?.error?.name;
  const errLine = errName ? `\n    → ${errName}: ${d.error?.message || d.fields?.error?.message || ''}` : '';
  console.log(`${time} ${level} ${ctx}${extra} ${msg}${errLine}`);
}
