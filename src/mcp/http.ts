import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

const port = Number(process.env.MCP_PORT ?? 4318);

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

const httpServer = createServer(async (request, response) => {
  if (request.url !== "/mcp") {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" }).end();
    return;
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
  } catch {
    if (!response.headersSent) {
      response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({
        jsonrpc: "2.0", error: { code: -32600, message: "Invalid MCP request." }, id: null,
      }));
    }
  }
});

httpServer.listen(port, "127.0.0.1", () => {
  console.error(`Acme demo MCP HTTP server listening on http://127.0.0.1:${port}/mcp`);
});
