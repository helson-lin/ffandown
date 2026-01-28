module.exports = {
    testEnvironment: 'node',
    verbose: true,
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'bin/router/**/*.js',
        'bin/middleware/**/*.js',
        'bin/utils/**/*.js',
    ],
}
