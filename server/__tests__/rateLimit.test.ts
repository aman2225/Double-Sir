import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucket, createChatBucket, createEmojiBucket } from "../rateLimit";

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows consuming up to capacity, then rejects", () => {
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 1 });
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it("refills over time, capped at capacity", () => {
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1 });
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(1000); // +1s -> +1 token
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(10_000); // long gap should cap at capacity, not overflow
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it("emoji bucket enforces a strict one-per-2-seconds cooldown with no burst beyond 1", () => {
    const bucket = createEmojiBucket();
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(1900);
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(2001);
    expect(bucket.consume()).toBe(true);
  });

  it("chat bucket allows a burst of 5 then throttles to roughly one per 3s", () => {
    const bucket = createChatBucket();
    for (let i = 0; i < 5; i++) {
      expect(bucket.consume()).toBe(true);
    }
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(3000);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });
});
