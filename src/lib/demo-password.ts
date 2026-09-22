import { createHmac, timingSafeEqual } from "node:crypto";

export const DEMO_PASSWORD_MIN_LENGTH = 8;
export const DEMO_SESSION_COOKIE = "acme_demo_access";

function safeEqual(expected: string, provided: string) {
  const want = Buffer.from(expected);
  const got = Buffer.from(provided);
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

export function configuredDemoPassword() {
  const password = process.env.DEMO_PASSWORD ?? "";
  return password.length >= DEMO_PASSWORD_MIN_LENGTH ? password : undefined;
}

function sessionValue(password: string) {
  return createHmac("sha256", password).update("acme-intake-demo-session-v1").digest("base64url");
}

export function isValidDemoPassword(password: string) {
  const expected = configuredDemoPassword();
  return Boolean(expected && safeEqual(expected, password));
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([cookieName]) => cookieName === name)?.[1];
}

export function hasDemoSession(cookieHeader: string | null) {
  const password = configuredDemoPassword();
  const provided = cookieValue(cookieHeader, DEMO_SESSION_COOKIE);
  return Boolean(password && provided && safeEqual(sessionValue(password), provided));
}

export function createDemoSession() {
  const password = configuredDemoPassword();
  return password ? sessionValue(password) : undefined;
}
