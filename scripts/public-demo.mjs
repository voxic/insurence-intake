import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIN_TOKEN_LENGTH = 24;
const token = process.env.MCP_AUTH_TOKEN ?? "";
if (token.length < MIN_TOKEN_LENGTH) {
  console.error("MCP_AUTH_TOKEN must be set (min 24 characters). Refusing to start the public demo.");
  process.exit(1);
}

// Emil-confirmed: the public host must never expose an open /api/session, which
// mints Realtime tokens with the real XAI_API_KEY. Require the session gate here
// (local `npm run dev` stays open because it does not use this entrypoint).
const MIN_SESSION_TOKEN_LENGTH = 16;
if ((process.env.SESSION_ACCESS_TOKEN ?? "").length < MIN_SESSION_TOKEN_LENGTH) {
  console.error("SESSION_ACCESS_TOKEN must be set (min 16 characters) for public start. Refusing to start the public demo.");
  process.exit(1);
}

const MIN_DEMO_PASSWORD_LENGTH = 8;
if ((process.env.DEMO_PASSWORD ?? "").length < MIN_DEMO_PASSWORD_LENGTH) {
  console.error("DEMO_PASSWORD must be set (min 8 characters) for public start. Refusing to start the public demo.");
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => path.join(root, "node_modules", ".bin", name);
const publicPort = Number(process.env.PORT ?? 8080);
const nextPort = Number(process.env.NEXT_INTERNAL_PORT ?? 4317);
const mcpPort = Number(process.env.MCP_PORT ?? 4318);
// Shared JSON/transcript root. Both Next and MCP must resolve the same volume.
const dataDir = process.env.DATA_DIR ?? path.join(root, "data");

function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
  return child;
}

const next = spawnChild(bin("next"), ["start", "--hostname", "127.0.0.1", "--port", String(nextPort)], {
  DATA_DIR: dataDir,
});
const mcp = spawnChild(bin("tsx"), ["src/mcp/http.ts"], {
  MCP_HOST: "127.0.0.1",
  MCP_PORT: String(mcpPort),
  DATA_DIR: dataDir,
});

function proxy(req, res, port) {
  const upstream = httpRequest(
    {
      hostname: "127.0.0.1",
      port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502).end("upstream unavailable");
  });
  req.pipe(upstream);
}

const server = createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  // Liveness only: confirms the public proxy is up, not upstream readiness.
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  // MCP bearer auth is enforced by the MCP server itself.
  if (pathname === "/mcp") {
    proxy(req, res, mcpPort);
    return;
  }
  // Everything else is the public demo app (synthetic data). /api/session is
  // guarded inside Next via SESSION_ACCESS_TOKEN / rate limit.
  proxy(req, res, nextPort);
});

function shutdown() {
  next.kill("SIGTERM");
  mcp.kill("SIGTERM");
  server.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(publicPort, "0.0.0.0", () => {
  console.error(`Public demo listening on 0.0.0.0:${publicPort} (MCP at /mcp)`);
});
