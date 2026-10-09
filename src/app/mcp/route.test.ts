/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { resetState, getCustomer } from "@/lib/backoffice/repository";
import { MCP_AUTH_TOKEN_MIN_LENGTH } from "@/mcp/auth";
import { GET, POST } from "./route";

const token = "c".repeat(MCP_AUTH_TOKEN_MIN_LENGTH);
const rpc = (method: string, params: Record<string, unknown>, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const initializeBody = rpc("initialize", {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "auth-test", version: "0.0.0" },
});

function post(body: string, authorization?: string) {
  return POST(new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authorization ? { authorization } : {}),
    },
    body,
  }));
}

/** Stateless transport answers each POST with one SSE stream; pull the JSON-RPC result out of it. */
async function rpcResult(response: Response) {
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data!.slice("data: ".length)) as { result: Record<string, unknown> };
}

afterEach(async () => {
  delete process.env.MCP_AUTH_TOKEN;
  await resetState();
});

describe("in-process MCP route", () => {
  it("rejects unauthenticated tool traffic with 401", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    const response = await post(initializeBody);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a wrong bearer even when the body is a valid MCP initialize", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    const response = await post(initializeBody, `Bearer ${"d".repeat(MCP_AUTH_TOKEN_MIN_LENGTH)}`);
    expect(response.status).toBe(401);
  });

  it("refuses everything when no MCP_AUTH_TOKEN is configured", async () => {
    const response = await post(initializeBody, `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it("only accepts POST", async () => {
    const response = GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("allows an authenticated MCP initialize", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    const response = await post(initializeBody, `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("acme-insurance-demo");
  });

  it("writes through MCP into the same in-memory store the backoffice reads", async () => {
    process.env.MCP_AUTH_TOKEN = token;
    const response = await post(rpc("tools/call", {
      name: "update_demo_customer", arguments: { customerId: "cus_ada", status: "inactive" },
    }), `Bearer ${token}`);
    expect(response.status).toBe(200);
    const { result } = await rpcResult(response);
    expect(result.structuredContent).toMatchObject({ updated: true, customer: { customerId: "cus_ada", status: "inactive" } });
    expect((await getCustomer("cus_ada"))?.status).toBe("inactive");
  });
});
