import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // Les fichiers e2e partagent la même base et la vident : jamais en parallèle.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
  // SWC est requis pour émettre les métadonnées de décorateurs utilisées par l'injection Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
