# Contributing to stellarcade-bot

Thanks for your interest in contributing! Please read these rules before you
start — pull requests that don't follow them will be closed.

## The rules

1. **Fork the repo and work from your fork.**

   ```sh
   gh repo fork TheBlockCade/stellarcade-bot --clone
   cd stellarcade-bot
   git checkout -b my-change
   git push -u origin my-change
   ```

2. **All pull requests target `main`.**

3. **Contributor changes must stay inside `contrib/`** unless the change is a
   bug fix with a linked issue. See [contrib/README.md](contrib/README.md).

4. **Never add a code path that requests, logs, or stores a private key or
   seed phrase.** This bot's entire trust model rests on never touching
   secret key material — see `src/core/session-link.ts`. A PR that weakens
   this will be closed regardless of what problem it's solving.

## Before you open a PR

```sh
npm install
npm run typecheck
npm test
npm run build
```

New commands need tests using the same mocking pattern as the existing
adapter tests (`src/adapters/*.test.ts`) — no live Telegram/Discord API
calls in the test suite.
