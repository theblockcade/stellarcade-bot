import { readFile, writeFile, rename } from "node:fs/promises";
import type { Platform } from "./types.js";

export interface LinkStore {
  getAddress(platform: Platform, userId: string): Promise<string | null>;
  setAddress(platform: Platform, userId: string, address: string): Promise<void>;
}

function key(platform: Platform, userId: string): string {
  return `${platform}:${userId}`;
}

export class InMemoryLinkStore implements LinkStore {
  private links = new Map<string, string>();

  async getAddress(platform: Platform, userId: string): Promise<string | null> {
    return this.links.get(key(platform, userId)) ?? null;
  }

  async setAddress(platform: Platform, userId: string, address: string): Promise<void> {
    this.links.set(key(platform, userId), address);
  }
}

/**
 * JSON-file-backed store so linked accounts survive a bot restart without
 * requiring a database — appropriate for this service's scale (a
 * platform-userId -> Stellar-address map), not a general persistence
 * pattern to reach for elsewhere. Writes go through a temp file + rename so
 * a crash mid-write can't corrupt the file.
 */
export class JsonFileLinkStore implements LinkStore {
  private cache: Map<string, string> | null = null;

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Map<string, string>> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cache = new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.cache = new Map();
      } else {
        throw err;
      }
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    const map = await this.load();
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(Object.fromEntries(map), null, 2), "utf8");
    await rename(tmpPath, this.filePath);
  }

  async getAddress(platform: Platform, userId: string): Promise<string | null> {
    const map = await this.load();
    return map.get(key(platform, userId)) ?? null;
  }

  async setAddress(platform: Platform, userId: string, address: string): Promise<void> {
    const map = await this.load();
    map.set(key(platform, userId), address);
    await this.persist();
  }
}
