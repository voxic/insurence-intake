import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

const serverOnlyKey = "xai-server-only-key";

afterEach(() => {
  delete process.env.XAI_API_KEY;
});

describe("browser secret boundary", () => {
  it("does not embed the configured xAI key in desk-phone HTML or client code", async () => {
    process.env.XAI_API_KEY = serverOnlyKey;
    const html = renderToStaticMarkup(createElement(Home));
    const clientSources = await Promise.all(
      [
        "components/desk-scene.tsx",
        "components/demo-login-gate.tsx",
        "hooks/use-voice-call.ts",
        "lib/realtime-client.ts",
      ].map((file) => readFile(path.join(process.cwd(), "src", file), "utf8")),
    );

    expect(html).not.toContain(serverOnlyKey);
    expect(clientSources.join("\n")).not.toContain(serverOnlyKey);
  });
});
