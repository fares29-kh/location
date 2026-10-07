import { createConfig } from '@drivetn/config/eslint';

export default [
  // Déclarations de types des presets JS partagés (hors de tout projet TypeScript).
  { ignores: ['packages/config/**/*.d.ts'] },
  ...createConfig({
    tsconfigRootDir: import.meta.dirname,
    nestApps: ['apps/api'],
    nextApps: ['apps/web'],
    reactPackages: ['packages/ui'],
  }),
];
