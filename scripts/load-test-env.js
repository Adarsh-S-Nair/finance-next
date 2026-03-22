#!/usr/bin/env node
/**
 * Load .env.test into the environment and spawn the next command.
 * Usage: node scripts/load-test-env.js next dev
 *        node scripts/load-test-env.js next build
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

const envFile = resolve(process.cwd(), '.env.test');

if (!existsSync(envFile)) {
  console.error(
    '[load-test-env] ERROR: .env.test not found.\n' +
    'Run: cp .env.test.example .env.test\n' +
    'Then fill in your test Supabase credentials.'
  );
  process.exit(1);
}

// Parse .env.test
const env = { ...process.env };
const content = readFileSync(envFile, 'utf8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  env[key] = value;
}

console.log(`[load-test-env] Loaded ${Object.keys(env).length} variables from .env.test`);
console.log(`[load-test-env] PLAID_ENV=${env.PLAID_ENV || '(not set)'}`);

// Spawn the remaining args as a command
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('[load-test-env] No command provided. Usage: node scripts/load-test-env.js <command> [args...]');
  process.exit(1);
}

const child = spawn(cmd, args, {
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error(`[load-test-env] Failed to start "${cmd}":`, err.message);
  process.exit(1);
});
