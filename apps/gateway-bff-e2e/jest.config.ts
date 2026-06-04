/* eslint-disable */
export default {
  displayName: 'gateway-bff-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.e2e.json' }],
  },
  moduleNameMapper: {
    '^@lingua/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@lingua/kafka$': '<rootDir>/../../libs/kafka/src/index.ts',
    '^@lingua/auth$': '<rootDir>/../../libs/auth/src/index.ts',
    '^axios$': require.resolve('axios/dist/node/axios.cjs'),
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/gateway-bff-e2e',
};
