import { describe, expect, it, vi } from "vitest";

const listeners = new Map<string, (...args: unknown[]) => Promise<void> | void>();

vi.mock("discord.js", () => {
  class FakeClient {
    on(event: string, handler: (...args: unknown[]) => Promise<void> | void) {
      listeners.set(event, handler);
    }
    once(event: string, handler: (...args: unknown[]) => Promise<void> | void) {
      listeners.set(event, handler);
    }
  }
  return {
    Client: FakeClient,
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2, MessageContent: 4, DirectMessages: 8 },
    Partials: { Channel: 1 },
  };
});

const { createDiscordBot } = await import("./discord.js");
const { CommandRouter } = await import("../core/command-router.js");

describe("createDiscordBot", () => {
  it("registers a messageCreate listener", () => {
    const router = new CommandRouter();
    createDiscordBot(router);
    expect(listeners.has("messageCreate")).toBe(true);
  });

  it("routes a !command message, normalized to a / command, through the router", async () => {
    listeners.clear();
    const router = new CommandRouter();
    const handle = vi.fn(async () => {});
    router.register({ name: "ping", description: "ping", handle });

    createDiscordBot(router);
    const onMessage = listeners.get("messageCreate")!;

    const replies: string[] = [];
    await onMessage({
      author: { bot: false, id: "42", username: "tester" },
      content: "!ping",
      reply: async (text: string) => {
        replies.push(text);
      },
    });

    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ platform: "discord", userId: "42" }));
  });

  it("ignores messages from other bots", async () => {
    listeners.clear();
    const router = new CommandRouter();
    const handle = vi.fn(async () => {});
    router.register({ name: "ping", description: "ping", handle });

    createDiscordBot(router);
    const onMessage = listeners.get("messageCreate")!;

    await onMessage({
      author: { bot: true, id: "99", username: "other-bot" },
      content: "!ping",
      reply: async () => {},
    });

    expect(handle).not.toHaveBeenCalled();
  });

  it("ignores plain chat that isn't prefixed with ! or /", async () => {
    listeners.clear();
    const router = new CommandRouter();
    const handle = vi.fn(async () => {});
    router.register({ name: "ping", description: "ping", handle });

    createDiscordBot(router);
    const onMessage = listeners.get("messageCreate")!;

    await onMessage({
      author: { bot: false, id: "42", username: "tester" },
      content: "just chatting",
      reply: async () => {},
    });

    expect(handle).not.toHaveBeenCalled();
  });
});
