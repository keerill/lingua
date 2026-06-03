/* eslint-disable */
export default {
  displayName: 'svc-learning',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@lingua/contracts/proto$': '<rootDir>/../../libs/contracts/src/generated/index.ts',
    '^@lingua/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@lingua/kafka$': '<rootDir>/../../libs/kafka/src/index.ts',
    '^@lingua/grpc$': '<rootDir>/../../libs/grpc/src/index.ts',
    '^@lingua/auth$': '<rootDir>/../../libs/auth/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/svc-learning',
};
