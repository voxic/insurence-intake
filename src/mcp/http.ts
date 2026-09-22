import { createServer } from "node:http";
import { configuredMcpAuthToken } from "./auth";
import { handleMcpHttpRequest } from "./http-handler";

const port = Number(process.env.MCP_PORT ?? 4318);
const host = process.env.MCP_HOST ?? "127.0.0.1";

if (!configuredMcpAuthToken()) {
  console.error("MCP_AUTH_TOKEN is required (min 24 characters). Refusing to start the MCP HTTP server.");
  process.exit(1);
}

const httpServer = createServer((request, response) => {
  void handleMcpHttpRequest(request, response);
});

httpServer.listen(port, host, () => {
  console.error(`Acme demo MCP HTTP server listening on http://${host}:${port}/mcp`);
});
