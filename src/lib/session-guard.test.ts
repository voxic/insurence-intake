import { afterEach, describe, expect, it } from "vitest";
import {
  clientKeyFrom,
  configuredSessionAccessToken,
  createRateLimiter,
  isAuthorizedSessionRequest,
  sessionCredentialFrom,
  SESSION_ACCESS_TOKEN_MIN_LENGTH,
} from "./session-guard";

const token = "s".repeat(SESSION_ACCESS_TOKEN_MIN_LENGTH);

afterEach(() => {
  delete process.env.SESSION_ACCESS_TOKEN;
});

describe("session access token guard", () => {
  it("is open (disabled) when no token or a too-short token is configured", () => {
    delete process.env.SESSION_ACCESS_TOKEN;
    expect(configuredSessionAccessToken()).toBeUndefined();
    expect(isAuthorizedSessionRequest(undefined)).toBe(true);

    process.env.SESSION_ACCESS_TOKEN = "short";
    expect(configuredSessionAccessToken()).toBeUndefined();
    expect(isAuthorizedSessionRequest(undefined)).toBe(true);
  });

  it("rejects missing or wrong credentials once a token is configured", () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    expect(isAuthorizedSessionRequest(undefined)).toBe(false);
    expect(isAuthorizedSessionRequest("wrong-value-1234")).toBe(false);
    expect(isAuthorizedSessionRequest(`${token}extra`)).toBe(false);
  });

  it("allows the exact credential from Bearer or x-session-access-token", () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    expect(sessionCredentialFrom({ authorization: `Bearer ${token}` })).toBe(token);
    expect(sessionCredentialFrom({ sessionAccessToken: token })).toBe(token);
    expect(isAuthorizedSessionRequest(token)).toBe(true);
  });
});

describe("session rate limiter", () => {
  it("blocks once the window limit is reached and recovers after it passes", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check("ip", 0).allowed).toBe(true);
    expect(limiter.check("ip", 100).allowed).toBe(true);
    const blocked = limiter.check("ip", 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
    expect(limiter.check("ip", 1101).allowed).toBe(true);
  });

  it("tracks callers independently and can be disabled with limit 0", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 0).allowed).toBe(false);

    const disabled = createRateLimiter({ limit: 0, windowMs: 1000 });
    expect(disabled.check("a", 0).allowed).toBe(true);
    expect(disabled.check("a", 0).allowed).toBe(true);
  });
});

describe("client key extraction", () => {
  it("prefers Fly client IP, then forwarded-for, then unknown", () => {
    expect(clientKeyFrom({ flyClientIp: "1.2.3.4" })).toBe("1.2.3.4");
    expect(clientKeyFrom({ forwardedFor: "5.6.7.8, 9.9.9.9" })).toBe("5.6.7.8");
    expect(clientKeyFrom({})).toBe("unknown");
  });
});
