import { describe, expect, it, vi } from "vitest";

const fakeTelegraf = { launch: vi.fn(async () => {}), stop: vi.fn() };
const fakeDiscordClient = { login: vi.fn(async () => {}), destroy: vi.fn(async () => {}) };

vi.mock("./adapters/telegram.js", () => ({
  createTelegramBot: vi.fn(() => fakeTelegraf),
}));
vi.mock("./adapters/discord.js", () => ({
  createDiscordBot: vi.fn(() => fakeDiscordClient),
}));

const { startBot } = await import("./bot.js");

function baseConfig() {
  return {
    gatewayUrl: "https://gateway.example.com",
    arbiterUrl: "https://arbiter.example.com",
    webAppUrl: "https://theblockcade.xyz",
    linkStorePath: "/tmp/does-not-need-to-exist-yet.json",
    telegramBotToken: undefined,
    discordBotToken: undefined,
    nodeEnv: "test" as const,
  };
}

describe("startBot", () => {
  it("launches only Telegram when only its token is set", async () => {
    const bot = await startBot({ ...baseConfig(), telegramBotToken: "tg-token" });
    expect(fakeTelegraf.launch).toHaveBeenCalled();
    expect(bot.telegram).not.toBeNull();
    expect(bot.discord).toBeNull();
  });

  it("logs in only Discord when only its token is set", async () => {
    const bot = await startBot({ ...baseConfig(), discordBotToken: "dc-token" });
    expect(fakeDiscordClient.login).toHaveBeenCalledWith("dc-token");
    expect(bot.discord).not.toBeNull();
    expect(bot.telegram).toBeNull();
  });

  it("starts both platforms when both tokens are set", async () => {
    const bot = await startBot({ ...baseConfig(), telegramBotToken: "tg-token", discordBotToken: "dc-token" });
    expect(bot.telegram).not.toBeNull();
    expect(bot.discord).not.toBeNull();
  });

  it("stop() tears down whichever platforms were started", async () => {
    fakeTelegraf.stop.mockClear();
    fakeDiscordClient.destroy.mockClear();

    const bot = await startBot({ ...baseConfig(), telegramBotToken: "tg-token", discordBotToken: "dc-token" });
    await bot.stop();

    expect(fakeTelegraf.stop).toHaveBeenCalled();
    expect(fakeDiscordClient.destroy).toHaveBeenCalled();
  });
});
