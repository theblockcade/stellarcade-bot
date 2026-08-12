import http from "node:http";
import { startBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";

// Render's free tier only supports web services (not background workers).
// A minimal health-check server satisfies Render's port-binding requirement
// while the bot itself runs via long-polling in the background.
function startHealthServer(port: number): void {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "stellarcade-bot" }));
  });
  server.listen(port, () => {
    logger.info({ port }, "health-check server listening");
  });
}

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  startHealthServer(port);

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
