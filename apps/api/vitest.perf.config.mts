import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Mesures de performance : jamais lancées par `pnpm test` (voir `pnpm perf`). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/perf/**/*.perf.ts'],
    fileParallelism: false,
    testTimeout: 60 * 60_000,
    hookTimeout: 60 * 60_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
