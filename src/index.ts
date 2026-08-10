import { startBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const bot = await startBot(config);

  logger.info(
    { telegram: bot.telegram !== null, discord: bot.discord !== null },
    "stellarcade-bot started",
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
