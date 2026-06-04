/* eslint-disable */
export default {
  displayName: 'gateway-bff',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@lingua/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@lingua/kafka$': '<rootDir>/../../libs/kafka/src/index.ts',
    '^@lingua/auth$': '<rootDir>/../../libs/auth/src/index.ts',
    '^axios$': require.resolve('axios/dist/node/axios.cjs'),
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/gateway-bff',
};
