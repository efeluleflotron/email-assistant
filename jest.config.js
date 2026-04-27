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
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/helpers/"],
});
