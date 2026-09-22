/** @vitest-environment node */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { MCP_AUTH_TOKEN_MIN_LENGTH } from "./auth";
import { handleMcpHttpRequest } from "./http-handler";

const token = "c".repeat(MCP_AUTH_TOKEN_MIN_LENGTH);

const initializeBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "auth-test", version: "0.0.0" },
  },
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void handleMcpHttpRequest(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

afterEach(() => {
  delete process.env.MCP_AUTH_TOKEN;
});

describe("MCP HTTP request gate", () => {
  it("rejects unauthenticated tool traffic with 401", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: initializeBody,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });
  });

  it("rejects a wrong bearer even when the body is a valid MCP initialize", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${"d".repeat(MCP_AUTH_TOKEN_MIN_LENGTH)}`,
        },
        body: initializeBody,
      });
      expect(response.status).toBe(401);
    });
  });

  it("allows an authenticated MCP initialize", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${token}`,
        },
        body: initializeBody,
      });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("acme-insurance-demo");
    });
  });
});
