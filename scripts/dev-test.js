#!/usr/bin/env node
/**
 * Start Next.js dev server using .env.test instead of .env.local.
 *
 * Next.js auto-loads .env.local with highest priority and there's no flag to
 * disable it. This script temporarily renames .env.local out of the way,
 * copies .env.test → .env.local, runs `next dev`, then restores the original
 * on exit.
 */

const { existsSync, renameSync, copyFileSync } = require('fs');
const { spawn } = require('child_process');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const envLocal = resolve(root, '.env.local');
const envBackup = resolve(root, '.env.local.bak');
const envTest = resolve(root, '.env.test');

if (!existsSync(envTest)) {
  console.error('[dev-test] .env.test not found. Copy .env.test.example → .env.test and fill in your test Supabase credentials.');
  process.exit(1);
}

// Backup .env.local if it exists
const hadEnvLocal = existsSync(envLocal);
if (hadEnvLocal) {
  renameSync(envLocal, envBackup);
}

// Copy .env.test → .env.local so Next.js picks it up
copyFileSync(envTest, envLocal);
console.log('[dev-test] Loaded .env.test as .env.local');

function restore() {
  try {
    if (hadEnvLocal && existsSync(envBackup)) {
      renameSync(envBackup, envLocal);
      console.log('[dev-test] Restored original .env.local');
    } else if (!hadEnvLocal && existsSync(envLocal)) {
      // Remove the temp .env.local we created
      require('fs').unlinkSync(envLocal);
    }
  } catch (e) {
    console.error('[dev-test] Warning: could not restore .env.local:', e.message);
  }
}

// Pass through any extra args (e.g. --port 3001)
const args = ['dev', ...process.argv.slice(2)];
const child = spawn('npx', ['next', ...args], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.on('SIGINT', () => { restore(); process.exit(); });
process.on('SIGTERM', () => { restore(); process.exit(); });
child.on('exit', (code) => { restore(); process.exit(code ?? 0); });
child.on('error', (err) => {
  console.error('[dev-test] Failed to start next dev:', err.message);
  restore();
  process.exit(1);
});
