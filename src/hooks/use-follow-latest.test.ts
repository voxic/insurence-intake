import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeskNotepad } from "@/components/desk-notepad";
import { NEAR_BOTTOM_PX } from "@/hooks/use-follow-latest";
import type { IntakeCall, TranscriptTurn } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children?: ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children),
}));

const scrollTo = vi.fn();
const scrollIntoView = vi.fn();

function turn(id: string, speaker: TranscriptTurn["speaker"], text: string): TranscriptTurn {
  return {
    id,
    speaker,
    text,
    status: "final",
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function callWith(turns: TranscriptTurn[]): IntakeCall {
  return {
    id: "call-1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: null,
    status: "live",
    turns,
  };
}

function Host({ initial }: { initial: TranscriptTurn[] }) {
  const [turns, setTurns] = useState(initial);
  return createElement(
    "div",
    null,
    createElement(DeskNotepad, { call: callWith(turns) }),
    createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          setTurns((current) => [
            ...current,
            turn(`extra-${current.length}`, "user", `Extra line ${current.length}`),
          ]),
      },
      "add",
    ),
  );
}

function viewportOf(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
  if (!viewport) throw new Error("transcript viewport missing");
  return viewport;
}

function addLine(container: HTMLElement) {
  const button = [...container.querySelectorAll("button")].find((node) => node.textContent === "add");
  if (!button) throw new Error("add button missing");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function pinScroll(element: HTMLElement, scrollTop: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: 200 });
  Object.defineProperty(element, "scrollTop", { configurable: true, writable: true, value: scrollTop });
  element.dispatchEvent(new Event("scroll"));
}

describe("live transcript auto-scroll", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    scrollTo.mockClear();
    scrollIntoView.mockClear();
    HTMLElement.prototype.scrollTo = scrollTo;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    HTMLElement.prototype.scrollTo = originalScrollTo;
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("follows a new line on the viewport, including the first paint, and stays put when scrolled up", async () => {
    await act(async () => {
      root.render(
        createElement(Host, {
          initial: [turn("a", "agent", "Thanks for calling Acme."), turn("b", "user", "I need to file a claim.")],
        }),
      );
    });

    const viewport = viewportOf(container);
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.instances.at(-1)).toBe(viewport);
    expect(scrollIntoView).not.toHaveBeenCalled();

    scrollTo.mockClear();
    await act(async () => {
      addLine(container);
    });
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.instances.at(-1)).toBe(viewport);

    scrollTo.mockClear();
    pinScroll(viewport, 0);
    await act(async () => {
      addLine(container);
    });
    expect(scrollTo).not.toHaveBeenCalled();

    scrollTo.mockClear();
    pinScroll(viewport, 1000 - 200 - (NEAR_BOTTOM_PX - 1));
    await act(async () => {
      addLine(container);
    });
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.instances.at(-1)).toBe(viewport);
  });
});
