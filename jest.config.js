export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^test-src/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.jest.json',
            },
        ],
    },
    transformIgnorePatterns: ['/node_modules/'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/frontend/'],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/frontend/', '/src/mock/'],
    setupFiles: ['./jest.setup.js']
};