import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  ChallengeExpiredError,
  ChallengeNotFoundError,
  InvalidSignatureError,
  SessionLinker,
} from "./session-link.js";

describe("SessionLinker", () => {
  it("creates a fresh challenge per user", () => {
    const linker = new SessionLinker();
    const a = linker.createChallenge("telegram", "user1");
    const b = linker.createChallenge("telegram", "user2");
    expect(a.challenge).not.toBe(b.challenge);
  });

  it("confirms a correctly signed challenge and returns the address", () => {
    const linker = new SessionLinker();
    const keypair = Keypair.random();

    const { challenge } = linker.createChallenge("telegram", "user1");
    const signature = keypair.sign(Buffer.from(challenge, "utf8")).toString("base64");

    const address = linker.confirm("telegram", "user1", keypair.publicKey(), signature);
    expect(address).toBe(keypair.publicKey());
  });

  it("rejects a signature from the wrong keypair", () => {
    const linker = new SessionLinker();
    const signer = Keypair.random();
    const claimedAddress = Keypair.random(); // different keypair's public key

    const { challenge } = linker.createChallenge("telegram", "user1");
    const signature = signer.sign(Buffer.from(challenge, "utf8")).toString("base64");

    expect(() => linker.confirm("telegram", "user1", claimedAddress.publicKey(), signature)).toThrow(
      InvalidSignatureError,
    );
  });

  it("rejects a signature over the wrong message", () => {
    const linker = new SessionLinker();
    const keypair = Keypair.random();

    linker.createChallenge("telegram", "user1");
    const signature = keypair.sign(Buffer.from("not-the-challenge", "utf8")).toString("base64");

    expect(() => linker.confirm("telegram", "user1", keypair.publicKey(), signature)).toThrow(InvalidSignatureError);
  });

  it("throws ChallengeNotFoundError when no challenge is pending", () => {
    const linker = new SessionLinker();
    const keypair = Keypair.random();
    expect(() => linker.confirm("telegram", "user1", keypair.publicKey(), "sig")).toThrow(ChallengeNotFoundError);
  });

  it("throws ChallengeExpiredError after the TTL elapses", () => {
    let now = 0;
    const linker = new SessionLinker(1000);
    const keypair = Keypair.random();

    const { challenge } = linker.createChallenge("telegram", "user1", now);
    const signature = keypair.sign(Buffer.from(challenge, "utf8")).toString("base64");

    now += 5000;
    expect(() => linker.confirm("telegram", "user1", keypair.publicKey(), signature, now)).toThrow(
      ChallengeExpiredError,
    );
  });

  it("consumes the challenge on success — a replay fails", () => {
    const linker = new SessionLinker();
    const keypair = Keypair.random();

    const { challenge } = linker.createChallenge("telegram", "user1");
    const signature = keypair.sign(Buffer.from(challenge, "utf8")).toString("base64");

    linker.confirm("telegram", "user1", keypair.publicKey(), signature);
    expect(() => linker.confirm("telegram", "user1", keypair.publicKey(), signature)).toThrow(
      ChallengeNotFoundError,
    );
  });

  it("keeps challenges separate across platforms for the same userId", () => {
    const linker = new SessionLinker();
    const keypair = Keypair.random();

    const tg = linker.createChallenge("telegram", "same-id");
    linker.createChallenge("discord", "same-id");

    const tgSignature = keypair.sign(Buffer.from(tg.challenge, "utf8")).toString("base64");
    // Signing the telegram challenge should not confirm the discord session.
    expect(() => linker.confirm("discord", "same-id", keypair.publicKey(), tgSignature)).toThrow(
      InvalidSignatureError,
    );
  });
});
