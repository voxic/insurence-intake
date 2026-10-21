import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateSeed, getDemoProfile } from "@/lib/backoffice/repository";
import { SettingsPanel } from "./settings-panel";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children?: ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children),
}));

describe("settings seed switch", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await activateSeed("insurance");
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/demo/profile")) {
        return new Response(JSON.stringify(getDemoProfile()), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ voices: [], configured: false }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    await activateSeed("insurance");
  });

  it("lists every seed, what it contains, and links to the backoffice and phone", async () => {
    await act(async () => {
      root.render(createElement(SettingsPanel));
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Harborline Dispatch");
    });

    const text = container.textContent ?? "";
    expect(text).toContain("wipes in-memory edits");
    expect(text).toContain("restart or deploy returns to Acme Insurance");
    expect(text).toContain("next call uses them");
    for (const seed of getDemoProfile().seeds) {
      expect(text).toContain(seed.label);
      expect(text).toContain(seed.summary);
      expect(text).toContain(`Backoffice: ${seed.backoffice}.`);
    }
    expect(container.querySelector("a[href='/backoffice']")?.textContent).toContain("Open backoffice");
    expect(container.querySelector("a[href='/']")?.textContent).toContain("Desk phone");
    expect(text).toContain("Phone on the desk");
    expect(text).toContain("Agent voice");
  });
});
