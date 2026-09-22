import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isAuthorizedMcpRequest } from "./auth";
import { createMcpServer } from "./server";

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function requestPath(url: string | undefined) {
  if (!url) return "/";
  try {
    return new URL(url, "http://127.0.0.1").pathname;
  } catch {
    return url.split("?")[0] || "/";
  }
}

export async function handleMcpHttpRequest(request: IncomingMessage, response: ServerResponse) {
  if (requestPath(request.url) !== "/mcp") {
    response.writeHead(404).end();
    return "not_found";
  }
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" }).end();
    return "method_not_allowed";
  }
  if (!isAuthorizedMcpRequest(request.headers.authorization)) {
    response.writeHead(401, {
      "WWW-Authenticate": 'Bearer realm="mcp"',
      "content-type": "application/json",
    }).end(JSON.stringify({ error: "Unauthorized" }));
    return "unauthorized";
  }

  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(request, response, await readBody(request));
    response.once("close", () => {
      void transport.close();
      void server.close();
    });
    return "ok";
  } catch {
    if (!response.headersSent) {
      response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({
        jsonrpc: "2.0", error: { code: -32600, message: "Invalid MCP request." }, id: null,
      }));
    }
    return "bad_request";
  }
}
