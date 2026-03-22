import { withAxiom } from 'next-axiom';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// If USE_TEST_ENV is set, load .env.test and override process.env
// This runs before Next.js loads .env.local, so our values win
if (process.env.USE_TEST_ENV === '1') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envTestPath = resolve(__dirname, '.env.test');
  if (existsSync(envTestPath)) {
    const content = readFileSync(envTestPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = value; // override .env.local values
    }
    console.log('[test-env] Loaded .env.test (overriding .env.local)');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Optimize package imports to reduce dev server memory usage
  experimental: {
    optimizePackageImports: [
      'react-icons',
      'lodash',
      'date-fns',
      'recharts',
      '@nivo/core',
      '@nivo/bar',
      '@nivo/treemap',
      'victory',
      'framer-motion',
    ],
  },
};

export default withAxiom(nextConfig);


