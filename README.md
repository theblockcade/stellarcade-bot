# stellarcade-bot

[![CI](https://github.com/TheBlockCade/stellarcade-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/TheBlockCade/stellarcade-bot/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Telegram and Discord bot for **TheBlockCade**: play links, balances,
leaderboards, quests, tournaments, and in-chat fairness verification.

## No custody, ever

This bot never asks for, sees, or stores a private key. Account linking
uses a **signature challenge**: the bot generates a random string, you sign
it with your wallet in the web app, and the bot only verifies that
signature — see [`src/core/session-link.ts`](src/core/session-link.ts).
Anything that needs a real signature (placing a bet, claiming a prize) is a
deep link into the web app, never handled in chat.

## 🌐 Live Deployment
- **Live Web Service**: `https://stellarcade-bot.onrender.com`
- **Telegram Bot**: Active via `@StellarcadeOfficialBot`
- **Connected Services**: Express API (`https://stellarcade-backend.onrender.com/api`), Arbiter (`https://stellarcade-arbiter.onrender.com`)

## Commands

| Command | Description |
|---|---|
| `/help` | List available commands |
| `/link` | Connect your Stellar address via signature challenge |
| `/balance` | Show your linked wallet's balances |
| `/leaderboard [game]` | Top players, overall or per game |
| `/quest` | Your quest progress and streaks |
| `/tournament` | List tournaments |
| `/verify <roundId> <stake>` | Independently check a round's fairness proof |
| `/play [game]` | Get a link to play — all signing happens in the web app |

On Discord, the same commands work with either a `!` or `/` prefix (e.g.
`!balance`), since Discord's native `/` is reserved for slash-command
registration, which this bot doesn't use.

## Running locally

```bash
cp .env.example .env   # set TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN
npm install
npm run dev
```

Discord requires the **Message Content Intent** enabled for your bot
application in the Discord Developer Portal, or `message.content` arrives
empty for non-mention messages.

## Architecture

One shared [`CommandRouter`](src/core/command-router.ts) (parsing, rate
limiting, dispatch) sits behind two thin adapters —
[`adapters/telegram.ts`](src/adapters/telegram.ts) and
[`adapters/discord.ts`](src/adapters/discord.ts) — that translate each
platform's message event into a platform-neutral `CommandContext`. Command
logic in [`commands/index.ts`](src/commands/index.ts) is written once and
runs identically on both platforms.

## Testing

```bash
npm test
```

Both adapters are tested by mocking their underlying SDK (`telegraf`,
`discord.js`) rather than hitting real APIs — see
`src/adapters/*.test.ts`. Account linking is tested against real Ed25519
signatures via `@stellar/stellar-sdk`'s `Keypair`, not stubs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0 — see [LICENSE](LICENSE). See [NOTICE](NOTICE) for third-party
attribution.
