import { withAxiom } from 'next-axiom';
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Compile the shared workspace UI package from source (no dist/ build step)
  transpilePackages: ['@zervo/ui'],
  // Optimize package imports to reduce dev server memory usage
  experimental: {
    optimizePackageImports: [
      'react-icons',
      'lodash',
      'date-fns',
      'recharts',
      'framer-motion',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withAxiom(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Don't fail the build when auth token is missing — just skip source
  // map upload. Required so deploys succeed before user adds the Sentry
  // env vars in Vercel.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
});


