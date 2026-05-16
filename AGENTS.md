<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Hooks

This repo uses **Husky** to enforce quality gates:

| Hook | Runs | What it checks |
|------|------|----------------|
| `pre-commit` | on every `git commit` | ESLint on staged JS/TS files via lint-staged |
| `pre-push` | on every `git push` | Full test suite (`npm test`) |

## Emergency escape hatch

If you need to bypass the hooks (e.g. a WIP commit or a known-broken CI environment):

```sh
# skip pre-commit lint
git commit --no-verify

# skip pre-push tests
git push --no-verify
```

Use sparingly — bypassing hooks hides real problems and shifts the cost to reviewers.
