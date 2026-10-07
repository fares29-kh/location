import { createConfig } from '@drivetn/config/eslint';

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  nestApps: ['apps/api'],
  nextApps: ['apps/web'],
});
