import { describe, expect, it, vi } from "vitest";
import { CommandRouter } from "./command-router.js";
import type { CommandContext } from "./types.js";

function ctxStub(overrides: Partial<Omit<CommandContext, "args">> = {}) {
  const replies: string[] = [];
  const ctx = {
    platform: "telegram" as const,
    userId: "u1",
    displayName: "Tester",
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    }),
    ...overrides,
  };
  return { ctx, replies };
}

describe("CommandRouter.parse", () => {
  it("parses a command with args", () => {
    expect(CommandRouter.parse("/play coin-flip heads")).toEqual({ name: "play", args: ["coin-flip", "heads"] });
  });

  it("parses a bare command", () => {
    expect(CommandRouter.parse("/balance")).toEqual({ name: "balance", args: [] });
  });

  it("strips a Telegram @botname suffix", () => {
    expect(CommandRouter.parse("/play@StellarCadeBot coin-flip")).toEqual({ name: "play", args: ["coin-flip"] });
  });

  it("returns null for non-command text", () => {
    expect(CommandRouter.parse("hello there")).toBeNull();
  });
});

describe("CommandRouter.route", () => {
  it("dispatches to the matching handler with parsed args", async () => {
    const router = new CommandRouter();
    const handle = vi.fn(async () => {});
    router.register({ name: "play", description: "play a game", handle });

    const { ctx } = ctxStub();
    await router.route("/play coin-flip heads", ctx);

    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ args: ["coin-flip", "heads"] }));
  });

  it("replies with an unknown-command message for unregistered commands", async () => {
    const router = new CommandRouter();
    const { ctx, replies } = ctxStub();

    await router.route("/nope", ctx);
    expect(replies[0]).toMatch(/Unknown command/);
  });

  it("ignores non-command messages silently", async () => {
    const router = new CommandRouter();
    const { ctx, replies } = ctxStub();

    await router.route("just chatting", ctx);
    expect(replies).toHaveLength(0);
  });

  it("catches a handler error and replies instead of throwing", async () => {
    const router = new CommandRouter();
    router.register({
      name: "boom",
      description: "always fails",
      handle: async () => {
        throw new Error("kaboom");
      },
    });
    const { ctx, replies } = ctxStub();

    await expect(router.route("/boom", ctx)).resolves.toBeUndefined();
    expect(replies[0]).toMatch(/kaboom/);
  });

  it("rate limits a user after the configured capacity", async () => {
    const router = new CommandRouter({ rateLimitCapacity: 2, rateLimitRefillPerSecond: 0 });
    const handle = vi.fn(async () => {});
    router.register({ name: "ping", description: "ping", handle });
    const { ctx, replies } = ctxStub();

    await router.route("/ping", ctx);
    await router.route("/ping", ctx);
    await router.route("/ping", ctx);

    expect(handle).toHaveBeenCalledTimes(2);
    expect(replies.at(-1)).toMatch(/too fast/);
  });

  it("rejects registering the same command name twice", () => {
    const router = new CommandRouter();
    router.register({ name: "play", description: "a", handle: async () => {} });
    expect(() => router.register({ name: "play", description: "b", handle: async () => {} })).toThrow(
      /already registered/,
    );
  });
});
