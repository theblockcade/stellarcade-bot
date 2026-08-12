export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface BotConfig {
  gatewayUrl: string;
  arbiterUrl: string;
  webAppUrl: string;
  linkStorePath: string;
  telegramBotToken: string | undefined;
  discordBotToken: string | undefined;
  nodeEnv: "development" | "test" | "production";
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * At least one of TELEGRAM_BOT_TOKEN / DISCORD_BOT_TOKEN must be set — a
 * bot with neither adapter configured can't do anything, so that's a
 * startup failure rather than a silent no-op process.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const gatewayUrl = requireEnv(env, "GATEWAY_URL");
  const arbiterUrl = requireEnv(env, "ARBITER_URL");
  const webAppUrl = requireEnv(env, "WEB_APP_URL");

  const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
  const discordBotToken = env.DISCORD_BOT_TOKEN;

  if (!telegramBotToken && !discordBotToken) {
    // Log a warning instead of crashing — the health-check server will keep
    // the Render service alive so env vars can be fixed without a crash loop.
    console.warn(
      "[stellarcade-bot] WARNING: Neither TELEGRAM_BOT_TOKEN nor DISCORD_BOT_TOKEN is set. " +
        "The bot will start but no adapters will be active. Add at least one token and redeploy.",
    );
  }

  return {
    gatewayUrl,
    arbiterUrl,
    webAppUrl,
    linkStorePath: env.LINK_STORE_PATH ?? "./data/links.json",
    telegramBotToken,
    discordBotToken,
    nodeEnv: (env.NODE_ENV as BotConfig["nodeEnv"]) ?? "development",
  };
}
