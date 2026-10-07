/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'worker', 'ui', 'types', 'config', 'docker', 'ci', 'deps', 'docs', 'repo'],
    ],
  },
};
