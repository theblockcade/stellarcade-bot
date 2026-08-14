# Repository Agent Standards

This file defines the minimum engineering standards that AI agents must follow
when working in this repository. These rules exist to prevent lint debt, weak
typing, build regressions, and workflow bypasses.

## Git and Hook Policy

- Never use `git commit --no-verify`.
- Never use `git push --no-verify`.
- Do not bypass, disable, or delete a failing hook. Fix the underlying issue
  instead.
- Direct pushes to `main` are never allowed, for anyone. Always work on a
  feature branch and open a pull request.
- Hooks live under `.githooks/` (version-controlled, not `.git/hooks/`) and
  are enabled via `git config core.hooksPath .githooks`, which `npm install`
  sets automatically via its `prepare` script (this one falls back silently
  with `|| true`, so double-check with `git config core.hooksPath` if you're
  unsure hooks are active). An unset hooksPath means every check below is
  silently skipped, with no error.
- `pre-push` runs, in order: `npm run typecheck`, `npm run lint`,
  `npm audit --audit-level=high`, `npm test`, `npm run build`. Every one of
  these must pass before a push succeeds.
- Confirm all of the above pass locally before pushing. If a check cannot be
  satisfied, report the blocker clearly instead of claiming the task is
  complete.

## Delivery Standard

Do not treat a task as complete until all of these pass:

- `npm run typecheck`
- `npm run lint`
- `npm audit --audit-level=high`
- `npm test`
- `npm run build`

CI (`.github/workflows/ci.yml`) runs the same set on every push/PR.

## Commit Message Standard

- Use the imperative mood in the subject line (e.g. `Fix settlement race`,
  not `Fixed` or `Fixes`).
- Keep the subject line to 50 characters or fewer where practical.
- Do not end the subject line with a period.
- Only add a body when it conveys information the subject line can't —
  don't restate the subject.
