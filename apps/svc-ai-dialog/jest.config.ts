/* eslint-disable */
export default {
  displayName: 'svc-ai-dialog',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@lingua/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@lingua/kafka$': '<rootDir>/../../libs/kafka/src/index.ts',
    '^@lingua/auth$': '<rootDir>/../../libs/auth/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/svc-ai-dialog',
};
