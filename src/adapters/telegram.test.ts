import { describe, expect, it, vi } from "vitest";

const registered: Array<{ filter: unknown; handler: (ctx: unknown) => Promise<void> }> = [];

vi.mock("telegraf", () => {
  class FakeTelegraf {
    on(filter: unknown, handler: (ctx: unknown) => Promise<void>) {
      registered.push({ filter, handler });
    }
    catch() {}
  }
  return { Telegraf: FakeTelegraf };
});

vi.mock("telegraf/filters", () => ({
  message: (type: string) => `message:${type}`,
}));

const { createTelegramBot } = await import("./telegram.js");
const { CommandRouter } = await import("../core/command-router.js");

describe("createTelegramBot", () => {
  it("registers a text message handler", () => {
    const router = new CommandRouter();
    createTelegramBot("fake-token", router);
    expect(registered).toHaveLength(1);
    expect(registered[0]?.filter).toBe("message:text");
  });

  it("routes an incoming text message through the shared CommandRouter", async () => {
    registered.length = 0;
    const router = new CommandRouter();
    const handle = vi.fn(async () => {});
    router.register({ name: "ping", description: "ping", handle });

    createTelegramBot("fake-token", router);
    const handler = registered[0]!.handler;

    const replies: string[] = [];
    await handler({
      message: { text: "/ping" },
      from: { id: 42, username: "tester" },
      reply: async (text: string) => {
        replies.push(text);
      },
    });

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "telegram", userId: "42", displayName: "tester" }),
    );
  });
});
