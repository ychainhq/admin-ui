module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  clearMocks: true,
  transform: { '^.+\\.js$': 'babel-jest' },
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '^../rivets\\.js$': '<rootDir>/tests/mocks/rivets.js',
    '^./rivets\\.js$': '<rootDir>/tests/mocks/rivets.js',
  },
};
