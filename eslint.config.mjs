import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // CJS config files that must use require()
    "jest.config.js",
    "jest.global-setup.js"
  ]),
  {
    rules: {
      "no-unused-vars": ["warn", {
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "semi": ["error", "always"],
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "brace-style": ["error", "1tbs"],
      "comma-dangle": ["error", "never"],
      "arrow-parens": ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "max-len": ["error", {
        "code": 100,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true
      }],
      "eol-last": ["error", "always"]
    }
  }
]);

export default eslintConfig;
