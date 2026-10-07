import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  reactStrictMode: true,
  // Le lint est exécuté à la racine du monorepo (pnpm lint) et en CI.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
