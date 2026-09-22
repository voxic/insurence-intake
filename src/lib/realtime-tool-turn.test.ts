import { describe, expect, it, vi } from "vitest";
import { RealtimeToolTurn } from "./realtime-tool-turn";

describe("RealtimeToolTurn", () => {
  it("sends all parallel tool outputs before one continued response after playback", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const run = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const sendOutput = vi.fn();
    const continueResponse = vi.fn();
    let releasePlayback: (() => void) | undefined;
    const turn = new RealtimeToolTurn({
      run,
      sendOutput,
      continueResponse,
      waitForPlayback: () =>
        new Promise<void>((resolve) => {
          releasePlayback = resolve;
        }),
    });

    turn.handle("call-1", "verify_demo_policy", "{}");
    turn.handle("call-2", "lookup_demo_product", "{}");
    turn.markResponseDone();
    resolvers[0]?.({ first: true });
    await Promise.resolve();
    expect(continueResponse).not.toHaveBeenCalled();
    resolvers[1]?.({ second: true });
    await vi.waitFor(() => expect(sendOutput).toHaveBeenCalledTimes(2));

    expect(continueResponse).not.toHaveBeenCalled();
    releasePlayback?.();
    await vi.waitFor(() => expect(continueResponse).toHaveBeenCalledTimes(1));
  });

  it("does not continue a cancelled tool turn", async () => {
    let resolveRun: ((value: unknown) => void) | undefined;
    const sendOutput = vi.fn();
    const continueResponse = vi.fn();
    const turn = new RealtimeToolTurn({
      run: () =>
        new Promise<unknown>((resolve) => {
          resolveRun = resolve;
        }),
      sendOutput,
      continueResponse,
      waitForPlayback: () => Promise.resolve(),
    });

    turn.handle("call-1", "verify_demo_policy", "{}");
    turn.markResponseDone();
    turn.interrupt();
    resolveRun?.({ found: true });
    await Promise.resolve();

    expect(sendOutput).not.toHaveBeenCalled();
    expect(continueResponse).not.toHaveBeenCalled();
  });
});
