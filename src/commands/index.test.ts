import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import type { ArcadeApiClient } from "../core/api-client.js";
import { InMemoryLinkStore } from "../core/link-store.js";
import { SessionLinker } from "../core/session-link.js";
import type { CommandContext } from "../core/types.js";
import { createCommands } from "./index.js";

// Mirrors how Freighter (and SEP-53-style wallets) actually sign messages:
// over sha256("Stellar Signed Message:\n" + message), not the raw bytes.
function signChallenge(keypair: Keypair, challenge: string): string {
  const hash = createHash("sha256").update(`Stellar Signed Message:\n${challenge}`, "utf8").digest();
  return keypair.sign(hash).toString("base64");
}

function apiStub(): ArcadeApiClient {
  return {
    getLeaderboard: vi.fn(async () => [{ rank: 1, playerAddress: "GABCDEFGHIJKLMNOP", score: "1000" }]),
    getQuests: vi.fn(async () => [{ questId: "q1", progress: 2, target: 5, claimed: false, streak: 1 }]),
    getTournaments: vi.fn(async () => [{ tournamentId: "t1", gameId: "dice-roll", status: "active", prizePool: "500" }]),
    getBalance: vi.fn(async () => ({ address: "GABC", balances: { XLM: "100" } })),
    verifyRound: vi.fn(async () => ({
      reproducible: true,
      commitmentMatches: true,
      derivedValueMatches: true,
      outcomeMatches: true,
    })),
  } as unknown as ArcadeApiClient;
}

function ctxFor(overrides: Partial<Omit<CommandContext, "args" | "reply">> = {}, args: string[] = []) {
  const replies: string[] = [];
  const ctx: CommandContext = {
    platform: "telegram",
    userId: "u1",
    displayName: "Tester",
    args,
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    }),
    ...overrides,
  };
  return { ctx, replies };
}

function findCommand(commands: ReturnType<typeof createCommands>, name: string) {
  const found = commands.find((c) => c.name === name);
  if (!found) throw new Error(`command ${name} not found`);
  return found;
}

describe("help command", () => {
  it("lists every registered command", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor();

    await findCommand(commands, "help").handle(ctx);
    expect(replies[0]).toContain("/play");
    expect(replies[0]).toContain("/verify");
  });
});

describe("link command", () => {
  it("issues a challenge and a sign link on bare /link", async () => {
    const sessionLinker = new SessionLinker();
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker,
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor();

    await findCommand(commands, "link").handle(ctx);
    expect(replies[0]).toContain("https://theblockcade.xyz/link?challenge=");
  });

  it("confirms and stores the address on /link <address> <signature>", async () => {
    const sessionLinker = new SessionLinker();
    const links = new InMemoryLinkStore();
    const commands = createCommands({ api: apiStub(), links, sessionLinker, webAppUrl: "https://theblockcade.xyz" });
    const keypair = Keypair.random();

    const { challenge } = sessionLinker.createChallenge("telegram", "u1");
    const signature = signChallenge(keypair, challenge);

    const { ctx, replies } = ctxFor({}, [keypair.publicKey(), signature]);
    await findCommand(commands, "link").handle(ctx);

    expect(replies[0]).toMatch(/Linked to/);
    expect(await links.getAddress("telegram", "u1")).toBe(keypair.publicKey());
  });

  it("replies with a failure message on a bad signature", async () => {
    const sessionLinker = new SessionLinker();
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker,
      webAppUrl: "https://theblockcade.xyz",
    });
    sessionLinker.createChallenge("telegram", "u1");

    const { ctx, replies } = ctxFor({}, ["GABC", "bad-signature"]);
    await findCommand(commands, "link").handle(ctx);
    expect(replies[0]).toMatch(/Link failed/);
  });
});

describe("balance command", () => {
  it("requires a linked account", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx } = ctxFor();

    await expect(findCommand(commands, "balance").handle(ctx)).rejects.toThrow(/isn't linked/);
  });

  it("shows balances for a linked account", async () => {
    const links = new InMemoryLinkStore();
    await links.setAddress("telegram", "u1", "GABC");
    const commands = createCommands({ api: apiStub(), links, sessionLinker: new SessionLinker(), webAppUrl: "https://theblockcade.xyz" });
    const { ctx, replies } = ctxFor();

    await findCommand(commands, "balance").handle(ctx);
    expect(replies[0]).toContain("XLM: 100");
  });
});

describe("leaderboard command", () => {
  it("formats leaderboard entries", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor();

    await findCommand(commands, "leaderboard").handle(ctx);
    expect(replies[0]).toContain("1000");
  });
});

describe("verify command", () => {
  it("requires roundId and stake args", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor();

    await findCommand(commands, "verify").handle(ctx);
    expect(replies[0]).toMatch(/Usage/);
  });

  it("reports a reproducible round as verified", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor({}, ["r1", "100000000"]);

    await findCommand(commands, "verify").handle(ctx);
    expect(replies[0]).toMatch(/verified — fair/);
  });
});

describe("play command", () => {
  it("links to the web app, never plays in-chat", async () => {
    const commands = createCommands({
      api: apiStub(),
      links: new InMemoryLinkStore(),
      sessionLinker: new SessionLinker(),
      webAppUrl: "https://theblockcade.xyz",
    });
    const { ctx, replies } = ctxFor({}, ["coin-flip"]);

    await findCommand(commands, "play").handle(ctx);
    expect(replies[0]).toContain("https://theblockcade.xyz/app/games/coin-flip");
  });
});
