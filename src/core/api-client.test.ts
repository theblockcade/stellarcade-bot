import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ArcadeApiClient } from "./api-client.js";

describe("ArcadeApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches the leaderboard with game and limit params and preserves baseUrl path prefix", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })) as unknown as typeof fetch;
    const client = new ArcadeApiClient("https://gateway.example.com/api", "https://arbiter.example.com");

    await client.getLeaderboard("dice-roll", 5);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = String(call?.[0]);
    expect(url).toContain("https://gateway.example.com/api/leaderboard");
    expect(url).toContain("game=dice-roll");
    expect(url).toContain("limit=5");
  });

  it("fetches quests for a player", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ questId: "q1", progress: 1, target: 3, claimed: false, streak: 0 }]), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const client = new ArcadeApiClient("https://gateway.example.com", "https://arbiter.example.com");

    const quests = await client.getQuests("GABC");
    expect(quests[0]?.questId).toBe("q1");
  });

  it("throws ApiError on a non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;
    const client = new ArcadeApiClient("https://gateway.example.com", "https://arbiter.example.com");

    await expect(client.getTournaments()).rejects.toBeInstanceOf(ApiError);
  });

  it("verifyRound fetches the proof then posts it to /verify", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/proofs/")) {
        return new Response(JSON.stringify({ roundId: "r1", gameId: "coin-flip" }), { status: 200 });
      }
      return new Response(JSON.stringify({ reproducible: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ArcadeApiClient("https://gateway.example.com", "https://arbiter.example.com");
    const result = await client.verifyRound("r1", "100000000");

    expect(result.reproducible).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
