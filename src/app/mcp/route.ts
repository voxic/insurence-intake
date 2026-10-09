import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isAuthorizedMcpRequest } from "@/mcp/auth";
import { createMcpServer } from "@/mcp/server";

// MCP runs inside the Next server process so its tools read and write the same
// in-memory backoffice store as /backoffice and the voice bridge. Stateless
// Streamable HTTP: one server + transport per POST, bearer-gated like before.
export async function POST(request: Request) {
  if (!isAuthorizedMcpRequest(request.headers.get("authorization") ?? undefined)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="mcp"' } });
  }
  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch {
    return Response.json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid MCP request." }, id: null }, { status: 400 });
  }
}

const methodNotAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
