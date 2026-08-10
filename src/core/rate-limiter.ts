/**
 * Per-user token bucket. Each user gets `capacity` tokens, refilled at
 * `refillPerSecond` tokens/second, capped at `capacity`. `tryConsume`
 * returns false without throwing — callers decide how to respond (a
 * "slow down" reply, silent drop, etc) rather than the limiter dictating
 * behavior via exceptions.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  tryConsume(key: string, cost = 1): boolean {
    const bucket = this.getOrCreate(key);
    this.refill(bucket);

    if (bucket.tokens < cost) {
      return false;
    }
    bucket.tokens -= cost;
    return true;
  }

  remaining(key: string): number {
    const bucket = this.getOrCreate(key);
    this.refill(bucket);
    return bucket.tokens;
  }

  private getOrCreate(key: string) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefillMs: this.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: { tokens: number; lastRefillMs: number }): void {
    const nowMs = this.now();
    const elapsedSeconds = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
    const refillAmount = elapsedSeconds * this.refillPerSecond;
    if (refillAmount > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refillAmount);
      bucket.lastRefillMs = nowMs;
    }
  }
}
