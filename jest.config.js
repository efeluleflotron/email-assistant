const nextJest = require("next/jest");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.test" });

const createJestConfig = nextJest({ dir: "." });

module.exports = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/helpers/", "/.claude/"],
  globalSetup: "<rootDir>/jest.global-setup.js",
  // Integration tests share a single Postgres DB — sequential execution prevents
  // concurrent runMigrations() calls from racing on the same migration tracking table.
  maxWorkers: 1,
});
