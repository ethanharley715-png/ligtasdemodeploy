module.exports = {
  preset: "ts-jest/presets/default-esm", // for ESM support
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/test/setupEnv.ts"],
  clearMocks: true,

  globals: {
    "ts-jest": {
      useESM: true,
    },
  },

  // Transform specific ESM modules in node_modules
  transformIgnorePatterns: [
    "node_modules/(?!p-limit|yocto-queue)"
  ],

  moduleNameMapper: {
    // Map TS path aliases if you have any
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
