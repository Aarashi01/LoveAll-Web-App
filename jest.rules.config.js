/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': [
      'babel-jest',
      {
        plugins: ['@babel/plugin-transform-modules-commonjs'],
        presets: ['@babel/preset-typescript'],
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase)/)',
  ],
  testMatch: ['<rootDir>/tests/firestore-rules.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
