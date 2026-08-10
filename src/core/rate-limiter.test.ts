import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
  it("allows consumption up to capacity", () => {
    const limiter = new RateLimiter(3, 1);
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(false);
  });

  it("tracks separate buckets per key", () => {
    const limiter = new RateLimiter(1, 1);
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user2")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(false);
  });

  it("refills over time", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1, () => now); // 1 token/sec

    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(false);

    now += 1000; // +1 second -> +1 token
    expect(limiter.tryConsume("user1")).toBe(true);
    expect(limiter.tryConsume("user1")).toBe(false);
  });

  it("never refills past capacity", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 10, () => now);

    now += 100_000; // huge elapsed time before first use
    expect(limiter.remaining("user1")).toBe(2);
  });

  it("reports remaining tokens without consuming", () => {
    const limiter = new RateLimiter(5, 1);
    expect(limiter.remaining("user1")).toBe(5);
    limiter.tryConsume("user1");
    expect(limiter.remaining("user1")).toBeCloseTo(4, 5);
  });
});
