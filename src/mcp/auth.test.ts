import { afterEach, describe, expect, it } from "vitest";
import {
  bearerFromAuthorization,
  configuredMcpAuthToken,
  isAuthorizedMcpRequest,
  MCP_AUTH_TOKEN_MIN_LENGTH,
} from "./auth";

const token = "a".repeat(MCP_AUTH_TOKEN_MIN_LENGTH);

afterEach(() => {
  delete process.env.MCP_AUTH_TOKEN;
});

describe("MCP HTTP bearer auth", () => {
  it("rejects an unset or too-short server token", () => {
    delete process.env.MCP_AUTH_TOKEN;
    expect(configuredMcpAuthToken()).toBeUndefined();
    expect(isAuthorizedMcpRequest(`Bearer ${token}`)).toBe(false);

    process.env.MCP_AUTH_TOKEN = "short";
    expect(configuredMcpAuthToken()).toBeUndefined();
    expect(isAuthorizedMcpRequest("Bearer short")).toBe(false);
  });

  it("rejects missing, malformed, and wrong bearer credentials", () => {
    process.env.MCP_AUTH_TOKEN = token;
    expect(isAuthorizedMcpRequest(undefined)).toBe(false);
    expect(isAuthorizedMcpRequest("Basic abc")).toBe(false);
    expect(isAuthorizedMcpRequest("Bearer")).toBe(false);
    expect(isAuthorizedMcpRequest(`Bearer ${"b".repeat(MCP_AUTH_TOKEN_MIN_LENGTH)}`)).toBe(false);
    expect(isAuthorizedMcpRequest(`Bearer ${token}extra`)).toBe(false);
  });

  it("allows an exact configured bearer token", () => {
    process.env.MCP_AUTH_TOKEN = token;
    expect(bearerFromAuthorization(`Bearer ${token}`)).toBe(token);
    expect(isAuthorizedMcpRequest(`Bearer ${token}`)).toBe(true);
    expect(isAuthorizedMcpRequest(`bearer ${token}`)).toBe(true);
  });
});
