import type { Client } from "discord.js";
import type { Telegraf } from "telegraf";
import { createDiscordBot } from "./adapters/discord.js";
import { createTelegramBot } from "./adapters/telegram.js";
import { ArcadeApiClient } from "./core/api-client.js";
import { CommandRouter } from "./core/command-router.js";
import { JsonFileLinkStore } from "./core/link-store.js";
import { SessionLinker } from "./core/session-link.js";
import { createCommands } from "./commands/index.js";
import type { BotConfig } from "./config.js";

export interface RunningBot {
  telegram: Telegraf | null;
  discord: Client | null;
  stop(): Promise<void>;
}

export async function startBot(config: BotConfig): Promise<RunningBot> {
  const api = new ArcadeApiClient(config.gatewayUrl, config.arbiterUrl);
  const links = new JsonFileLinkStore(config.linkStorePath);
  const sessionLinker = new SessionLinker();

  const router = new CommandRouter();
  for (const command of createCommands({ api, links, sessionLinker, webAppUrl: config.webAppUrl })) {
    router.register(command);
  }

  let telegram: Telegraf | null = null;
  let discord: Client | null = null;

  if (config.telegramBotToken) {
    telegram = createTelegramBot(config.telegramBotToken, router);
    await telegram.launch();
  }

  if (config.discordBotToken) {
    discord = createDiscordBot(router);
    await discord.login(config.discordBotToken);
  }

  return {
    telegram,
    discord,
    async stop() {
      telegram?.stop("shutdown");
      await discord?.destroy();
    },
  };
}
