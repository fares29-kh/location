import path from 'node:path';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@drivetn/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'radix-ui'],
  },
  // Le lint est exécuté à la racine du monorepo (pnpm lint) et en CI.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(nextConfig);
