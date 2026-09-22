import { timingSafeEqual } from "node:crypto";

export const SESSION_ACCESS_TOKEN_MIN_LENGTH = 16;

/**
 * Optional shared secret that gates `POST /api/session`. When unset (or too
 * short) the guard is disabled and the route is open — this is the
 * "easily disabled via env" default. Never expose via NEXT_PUBLIC_*.
 */
export function configuredSessionAccessToken() {
  const token = process.env.SESSION_ACCESS_TOKEN ?? "";
  return token.length >= SESSION_ACCESS_TOKEN_MIN_LENGTH ? token : undefined;
}

function safeEqual(expected: string, provided: string) {
  const want = Buffer.from(expected);
  const got = Buffer.from(provided);
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

function bearer(value: string | null) {
  if (!value) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1];
}

/**
 * Reads the caller-supplied session credential from either
 * `Authorization: Bearer <token>` or `x-session-access-token`.
 */
export function sessionCredentialFrom(headers: {
  authorization?: string | null;
  sessionAccessToken?: string | null;
}) {
  return bearer(headers.authorization ?? null) ?? headers.sessionAccessToken?.trim() ?? undefined;
}

/** True when no token is configured (open) or the supplied credential matches. */
export function isAuthorizedSessionRequest(credential: string | undefined) {
  const expected = configuredSessionAccessToken();
  if (!expected) return true;
  if (!credential) return false;
  return safeEqual(expected, credential);
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Reads the lightweight in-memory rate limit for `POST /api/session`.
 * Set `SESSION_RATE_LIMIT=0` to disable. Safe on a single instance only.
 */
export function sessionRateLimitConfig(): RateLimitConfig {
  const limit = Number(process.env.SESSION_RATE_LIMIT ?? 10);
  const windowMs = Number(process.env.SESSION_RATE_WINDOW_MS ?? 60_000);
  return {
    limit: Number.isFinite(limit) && limit >= 0 ? limit : 10,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

/** Sliding-window counter. `now` is injectable for deterministic tests. */
export function createRateLimiter(config: RateLimitConfig) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now: number = Date.now()): RateLimitDecision {
      if (config.limit <= 0) {
        return { allowed: true, remaining: Infinity, retryAfterMs: 0 };
      }
      const windowStart = now - config.windowMs;
      const recent = (hits.get(key) ?? []).filter((time) => time > windowStart);
      if (recent.length >= config.limit) {
        hits.set(key, recent);
        const retryAfterMs = Math.max(0, recent[0] + config.windowMs - now);
        return { allowed: false, remaining: 0, retryAfterMs };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, remaining: config.limit - recent.length, retryAfterMs: 0 };
    },
  };
}

/** Best-effort client key for rate limiting behind the Fly proxy. */
export function clientKeyFrom(headers: {
  flyClientIp?: string | null;
  forwardedFor?: string | null;
}) {
  const fly = headers.flyClientIp?.trim();
  if (fly) return fly;
  const forwarded = headers.forwardedFor?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
