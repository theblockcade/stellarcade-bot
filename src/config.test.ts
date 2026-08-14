import { describe, expect, it, vi } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

function baseEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    GATEWAY_URL: "https://gateway.example.com",
    ARBITER_URL: "https://arbiter.example.com",
    WEB_APP_URL: "https://theblockcade.xyz",
    TELEGRAM_BOT_TOKEN: "tg-token",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("loadConfig", () => {
  it("loads a valid config with only Telegram configured", () => {
    const config = loadConfig(baseEnv());
    expect(config.telegramBotToken).toBe("tg-token");
    expect(config.discordBotToken).toBeUndefined();
  });

  it("loads a valid config with only Discord configured", () => {
    const env = baseEnv({ DISCORD_BOT_TOKEN: "dc-token" });
    delete env.TELEGRAM_BOT_TOKEN;
    const config = loadConfig(env);
    expect(config.discordBotToken).toBe("dc-token");
  });

  it("warns but does not throw when neither bot token is set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = baseEnv();
    delete env.TELEGRAM_BOT_TOKEN;

    const config = loadConfig(env);

    expect(config.telegramBotToken).toBeUndefined();
    expect(config.discordBotToken).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Neither TELEGRAM_BOT_TOKEN nor DISCORD_BOT_TOKEN/));

    warnSpy.mockRestore();
  });

  it("throws when GATEWAY_URL is missing", () => {
    const env = baseEnv();
    delete env.GATEWAY_URL;
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("defaults linkStorePath when unset", () => {
    const config = loadConfig(baseEnv());
    expect(config.linkStorePath).toBe("./data/links.json");
  });

  it("uses a provided LINK_STORE_PATH", () => {
    const config = loadConfig(baseEnv({ LINK_STORE_PATH: "/custom/path.json" }));
    expect(config.linkStorePath).toBe("/custom/path.json");
  });
});
