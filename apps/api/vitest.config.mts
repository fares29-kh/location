import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
  // SWC est requis pour émettre les métadonnées de décorateurs utilisées par l'injection Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
