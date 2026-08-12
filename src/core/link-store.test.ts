import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLinkStore, JsonFileLinkStore, PostgresLinkStore } from "./link-store.js";

const queryMock = vi.fn();
const endMock = vi.fn();

vi.mock("pg", () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      query: queryMock,
      end: endMock,
    })),
  },
}));

describe("InMemoryLinkStore", () => {
  it("returns null for an unlinked user", async () => {
    const store = new InMemoryLinkStore();
    expect(await store.getAddress("telegram", "u1")).toBeNull();
  });

  it("stores and retrieves an address", async () => {
    const store = new InMemoryLinkStore();
    await store.setAddress("telegram", "u1", "GABC");
    expect(await store.getAddress("telegram", "u1")).toBe("GABC");
  });

  it("keeps platforms separate for the same userId", async () => {
    const store = new InMemoryLinkStore();
    await store.setAddress("telegram", "same", "GABC");
    expect(await store.getAddress("discord", "same")).toBeNull();
  });
});

describe("JsonFileLinkStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "stellarcade-bot-links-"));
    filePath = path.join(dir, "links.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns null when the file doesn't exist yet", async () => {
    const store = new JsonFileLinkStore(filePath);
    expect(await store.getAddress("telegram", "u1")).toBeNull();
  });

  it("persists an address to disk and a fresh store instance can read it", async () => {
    const store = new JsonFileLinkStore(filePath);
    await store.setAddress("telegram", "u1", "GABC");

    const reloaded = new JsonFileLinkStore(filePath);
    expect(await reloaded.getAddress("telegram", "u1")).toBe("GABC");
  });

  it("persists multiple entries correctly", async () => {
    const store = new JsonFileLinkStore(filePath);
    await store.setAddress("telegram", "u1", "GABC");
    await store.setAddress("discord", "u2", "GXYZ");

    const reloaded = new JsonFileLinkStore(filePath);
    expect(await reloaded.getAddress("telegram", "u1")).toBe("GABC");
    expect(await reloaded.getAddress("discord", "u2")).toBe("GXYZ");
  });
});

describe("PostgresLinkStore", () => {
  beforeEach(() => {
    queryMock.mockReset();
    endMock.mockReset();
  });

  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const store = new PostgresLinkStore("postgres://test");

    const result = await store.getAddress("telegram", "u1");

    expect(result).toBeNull();
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT wallet_address FROM bot_links WHERE platform = $1 AND user_id = $2",
      ["telegram", "u1"],
    );
  });

  it("returns the stored address when a row matches", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ wallet_address: "GABC" }] });
    const store = new PostgresLinkStore("postgres://test");

    expect(await store.getAddress("discord", "u2")).toBe("GABC");
  });

  it("upserts on setAddress with an ON CONFLICT clause keyed on platform+user_id", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const store = new PostgresLinkStore("postgres://test");

    await store.setAddress("telegram", "u1", "GABC");

    expect(queryMock).toHaveBeenCalledTimes(1);
    const call = queryMock.mock.calls[0];
    if (!call) throw new Error("expected queryMock to have been called");
    const [sql, params] = call;
    expect(sql).toMatch(/INSERT INTO bot_links/);
    expect(sql).toMatch(/ON CONFLICT \(platform, user_id\)/);
    expect(sql).toMatch(/DO UPDATE SET wallet_address = EXCLUDED\.wallet_address/);
    expect(params).toEqual(["telegram", "u1", "GABC"]);
  });

  it("propagates query errors from getAddress instead of swallowing them", async () => {
    queryMock.mockRejectedValueOnce(new Error("connection refused"));
    const store = new PostgresLinkStore("postgres://test");

    await expect(store.getAddress("telegram", "u1")).rejects.toThrow("connection refused");
  });

  it("propagates query errors from setAddress instead of swallowing them", async () => {
    queryMock.mockRejectedValueOnce(new Error("connection refused"));
    const store = new PostgresLinkStore("postgres://test");

    await expect(store.setAddress("telegram", "u1", "GABC")).rejects.toThrow("connection refused");
  });

  it("closes the underlying pool", async () => {
    endMock.mockResolvedValueOnce(undefined);
    const store = new PostgresLinkStore("postgres://test");

    await store.close();

    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
