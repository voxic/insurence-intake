import { timingSafeEqual } from "node:crypto";

export const MCP_AUTH_TOKEN_MIN_LENGTH = 24;

export function configuredMcpAuthToken() {
  const token = process.env.MCP_AUTH_TOKEN ?? "";
  return token.length >= MCP_AUTH_TOKEN_MIN_LENGTH ? token : undefined;
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function bearerFromAuthorization(value: string | string[] | undefined) {
  const header = headerValue(value);
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
}

export function isAuthorizedMcpRequest(authorization: string | string[] | undefined) {
  const expected = configuredMcpAuthToken();
  const provided = bearerFromAuthorization(authorization);
  if (!expected || !provided) return false;

  const want = Buffer.from(expected);
  const got = Buffer.from(provided);
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}
