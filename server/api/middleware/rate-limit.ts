import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_STORE_SIZE = 10_000;
const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every minute (was 5 min — tighter to bound memory)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
  // Hard cap: evict oldest entries if store still too large
  if (store.size > MAX_STORE_SIZE) {
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toEvict = entries.slice(0, store.size - MAX_STORE_SIZE);
    for (const [key] of toEvict) store.delete(key);
  }
}, 60 * 1000);

/**
 * Simple in-memory rate limiter.
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      throw new HTTPException(429, {
        message: "Too many requests — please try again later",
      });
    }

    await next();
  });
}
