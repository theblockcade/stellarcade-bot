import type { ArcadeApiClient } from "../core/api-client.js";
import type { LinkStore } from "../core/link-store.js";
import { SessionLinker } from "../core/session-link.js";
import type { CommandHandler } from "../core/types.js";

export interface CommandDeps {
  api: ArcadeApiClient;
  links: LinkStore;
  sessionLinker: SessionLinker;
  webAppUrl: string;
}

async function requireLinkedAddress(deps: CommandDeps, platform: "telegram" | "discord", userId: string): Promise<string> {
  const address = await deps.links.getAddress(platform, userId);
  if (!address) {
    throw new Error("Your account isn't linked yet. Run /link to connect your Stellar address.");
  }
  return address;
}

function truncate(address: string): string {
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

export function createCommands(deps: CommandDeps): CommandHandler[] {
  const help: CommandHandler = {
    name: "help",
    description: "List available commands",
    async handle(ctx) {
      const lines = commands.map((c) => `/${c.name} — ${c.description}`);
      await ctx.reply(["TheBlockCade bot commands:", ...lines].join("\n"));
    },
  };

  const link: CommandHandler = {
    name: "link",
    description: "Connect your Stellar address (opens the web app to sign a challenge)",
    async handle(ctx) {
      // /link <address> <signature> completes a pending challenge.
      if (ctx.args.length >= 2) {
        const [address, signature] = ctx.args;
        try {
          await deps.sessionLinker.confirm(ctx.platform, ctx.userId, address!, signature!);
          await deps.links.setAddress(ctx.platform, ctx.userId, address!);
          await ctx.reply(`Linked to ${truncate(address!)}. Try /balance or /quest now.`);
        } catch (err) {
          await ctx.reply(`Link failed: ${(err as Error).message}`);
        }
        return;
      }

      // Bare /link issues a fresh challenge and points at the web app to sign it —
      // the bot never asks for or sees a secret key.
      const { challenge } = deps.sessionLinker.createChallenge(ctx.platform, ctx.userId);
      const signUrl = `${deps.webAppUrl}/link?challenge=${encodeURIComponent(challenge)}&platform=${ctx.platform}&userId=${encodeURIComponent(ctx.userId)}`;
      await ctx.reply(
        `To link your Stellar address, open this page and sign the challenge with your wallet:\n${signUrl}\n\n` +
          `Then come back and run:\n/link <your-address> <signature>`,
      );
    },
  };

  const balance: CommandHandler = {
    name: "balance",
    description: "Show your linked wallet's balances",
    async handle(ctx) {
      const address = await requireLinkedAddress(deps, ctx.platform, ctx.userId);
      const result = await deps.api.getBalance(address);
      const lines = Object.entries(result.balances).map(([asset, amount]) => `${asset}: ${amount}`);
      await ctx.reply([`Balances for ${truncate(address)}:`, ...lines].join("\n"));
    },
  };

  const leaderboard: CommandHandler = {
    name: "leaderboard",
    description: "Show the top players (optionally: /leaderboard <game>)",
    async handle(ctx) {
      const gameId = ctx.args[0];
      const entries = await deps.api.getLeaderboard(gameId, 10);
      if (entries.length === 0) {
        await ctx.reply("No leaderboard entries yet.");
        return;
      }
      const lines = entries.map((e) => `${e.rank}. ${truncate(e.playerAddress)} — ${e.score}`);
      await ctx.reply([`Leaderboard${gameId ? ` (${gameId})` : ""}:`, ...lines].join("\n"));
    },
  };

  const quest: CommandHandler = {
    name: "quest",
    description: "Show your quest progress",
    async handle(ctx) {
      const address = await requireLinkedAddress(deps, ctx.platform, ctx.userId);
      const quests = await deps.api.getQuests(address);
      if (quests.length === 0) {
        await ctx.reply("No active quests.");
        return;
      }
      const lines = quests.map(
        (q) => `${q.questId}: ${q.progress}/${q.target}${q.claimed ? " ✓ claimed" : ""} (streak ${q.streak})`,
      );
      await ctx.reply(["Your quests:", ...lines].join("\n"));
    },
  };

  const tournament: CommandHandler = {
    name: "tournament",
    description: "List tournaments",
    async handle(ctx) {
      const tournaments = await deps.api.getTournaments();
      if (tournaments.length === 0) {
        await ctx.reply("No tournaments right now.");
        return;
      }
      const lines = tournaments.map((t) => `${t.gameId} (${t.status}) — prize pool ${t.prizePool}`);
      await ctx.reply(["Tournaments:", ...lines].join("\n"));
    },
  };

  const verify: CommandHandler = {
    name: "verify",
    description: "Verify a round's fairness proof: /verify <roundId> <stake>",
    async handle(ctx) {
      const [roundId, stake] = ctx.args;
      if (!roundId || !stake) {
        await ctx.reply("Usage: /verify <roundId> <stake>");
        return;
      }
      const result = await deps.api.verifyRound(roundId, stake);
      await ctx.reply(
        result.reproducible
          ? `✓ Round ${roundId} verified — fair.`
          : `✗ Round ${roundId} FAILED verification: ${result.reason}`,
      );
    },
  };

  const play: CommandHandler = {
    name: "play",
    description: "Get a link to play a game: /play <game>",
    async handle(ctx) {
      const gameId = ctx.args[0];
      const path = gameId ? `/app/games/${gameId}` : "/arcade";
      await ctx.reply(
        `Play here — the bot never holds your keys, all signing happens in the web app:\n${deps.webAppUrl}${path}`,
      );
    },
  };

  const commands = [help, link, balance, leaderboard, quest, tournament, verify, play];
  return commands;
}
