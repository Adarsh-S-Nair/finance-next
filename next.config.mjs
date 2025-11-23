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

export default nextConfig;


