import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";

const server = createMcpServer();
const transport = new StdioServerTransport();

void server.connect(transport).catch((error: unknown) => {
  console.error("Failed to start the demo MCP stdio server.", error);
  process.exitCode = 1;
});
