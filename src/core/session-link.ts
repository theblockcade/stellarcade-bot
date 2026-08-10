import { randomBytes } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import type { Platform } from "./types.js";

export interface LinkChallenge {
  challenge: string;
  platform: Platform;
  userId: string;
  createdAtMs: number;
  expiresAtMs: number;
}

export class ChallengeExpiredError extends Error {
  constructor() {
    super("Link challenge has expired — run /link again to get a new one");
    this.name = "ChallengeExpiredError";
  }
}

export class ChallengeNotFoundError extends Error {
  constructor() {
    super("No pending link challenge for this user — run /link first");
    this.name = "ChallengeNotFoundError";
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super("Signature does not verify against the given address for this challenge");
    this.name = "InvalidSignatureError";
  }
}

/**
 * Links a Telegram/Discord account to a Stellar address via a
 * signature-challenge, never a submitted key. The bot generates a random
 * challenge string; the player signs it themselves (in the web app, via
 * deep link — the bot never sees their secret key) and submits the address
 * + signature back. `confirm()` verifies the signature was produced by that
 * address's key over exactly that challenge.
 */
export class SessionLinker {
  private challenges = new Map<string, LinkChallenge>();

  constructor(private readonly validForMs: number = 10 * 60 * 1000) {}

  private key(platform: Platform, userId: string): string {
    return `${platform}:${userId}`;
  }

  createChallenge(platform: Platform, userId: string, now = Date.now()): LinkChallenge {
    const challenge = randomBytes(16).toString("hex");
    const record: LinkChallenge = {
      challenge,
      platform,
      userId,
      createdAtMs: now,
      expiresAtMs: now + this.validForMs,
    };
    this.challenges.set(this.key(platform, userId), record);
    return record;
  }

  /**
   * Verifies `signatureBase64` is a valid Ed25519 signature by `address`
   * over the pending challenge for this user, using Stellar's own key
   * format — the same keypair a Freighter/passkey wallet would sign with.
   */
  confirm(platform: Platform, userId: string, address: string, signatureBase64: string, now = Date.now()): string {
    const record = this.challenges.get(this.key(platform, userId));
    if (!record) {
      throw new ChallengeNotFoundError();
    }
    if (now > record.expiresAtMs) {
      this.challenges.delete(this.key(platform, userId));
      throw new ChallengeExpiredError();
    }

    const keypair = Keypair.fromPublicKey(address);
    const signature = Buffer.from(signatureBase64, "base64");
    const valid = keypair.verify(Buffer.from(record.challenge, "utf8"), signature);

    if (!valid) {
      throw new InvalidSignatureError();
    }

    this.challenges.delete(this.key(platform, userId));
    return address;
  }
}
