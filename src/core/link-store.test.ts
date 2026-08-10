import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryLinkStore, JsonFileLinkStore } from "./link-store.js";

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
