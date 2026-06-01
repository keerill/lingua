const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  coverageReporters: ['text', 'lcov'],
  // Most dependencies are CJS and must NOT be transformed, but a few key ones
  // (jose, axios) ship ESM-only and need transpiling for Jest's CJS runtime.
  transformIgnorePatterns: ['/node_modules/\\.pnpm/(?!(jose|axios)@)'],
};
