const path = require('node:path');

module.exports = {
    rootDir: path.resolve(__dirname, '../..'),
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/apis/modules/**/*.test.cjs'],
    setupFilesAfterEnv: ['<rootDir>/tests/apis/setup/jest.setup.cjs'],
    verbose: true,
    maxWorkers: 1,
    testTimeout: 120000
};
