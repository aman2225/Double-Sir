// Simple in-process token bucket rate limiter. No external store needed —
// each bucket lives on the owning socket's `socket.data` (see
// server/socketHandlers.ts's SocketData interface) so it's garbage
// collected automatically when the socket disconnects.
//
// Lazy refill: rather than a timer ticking down every bucket, we compute
// how many tokens should have accumulated since the last check whenever
// `consume` is called. O(1), no background work, no cleanup required.

export interface TokenBucketConfig {
  /** Maximum tokens the bucket can hold (i.e. the size of a burst). */
  capacity: number;
  /** Tokens regenerated per second. */
  refillPerSecond: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(private readonly config: TokenBucketConfig) {
    this.tokens = config.capacity;
    this.lastRefillMs = Date.now();
  }

  /** Attempts to consume `cost` tokens; returns false (and consumes nothing) if insufficient. */
  consume(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillMs) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(this.config.capacity, this.tokens + elapsedSeconds * this.config.refillPerSecond);
    this.lastRefillMs = now;
  }
}

// Pre-configured bucket factories for each comms event group. Tuned to
// allow normal bursty human use (a quick flurry of messages, ICE candidate
// trickling) while capping sustained spam.
export const createChatBucket = () => new TokenBucket({ capacity: 5, refillPerSecond: 1 / 3 });
export const createEmojiBucket = () => new TokenBucket({ capacity: 1, refillPerSecond: 1 / 2 });
export const createSignalingBucket = () => new TokenBucket({ capacity: 30, refillPerSecond: 10 });
