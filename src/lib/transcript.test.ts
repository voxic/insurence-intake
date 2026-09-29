import { describe, expect, it } from "vitest";
import { upsertTurn } from "./transcript";
import type { TranscriptTurn } from "./types";

const lines = (turns: TranscriptTurn[]) =>
  turns.map((turn) => `${turn.speaker}/${turn.status}: ${turn.text}`);

describe("upsertTurn", () => {
  it("replaces interim caller text on one line and finalizes it in place", () => {
    let turns = upsertTurn([], "user", "I would like to.", "partial", "user:a");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "partial", "user:a");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "final", "user:a");

    expect(lines(turns)).toEqual(["user/final: I would like to report a claim."]);
    expect(turns[0].id).toBe("user:a");
  });

  it("finds the line by id even when another speaker's line was appended after it", () => {
    let turns = upsertTurn([], "agent", "How can I", "partial", "agent:1");
    turns = upsertTurn(turns, "user", "I would like to.", "partial", "user:a");
    turns = upsertTurn(turns, "agent", "How can I help?", "final", "agent:1");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "partial", "user:a");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "final", "user:a");

    expect(lines(turns)).toEqual([
      "agent/final: How can I help?",
      "user/final: I would like to report a claim.",
    ]);
    expect(new Set(turns.map((turn) => turn.id)).size).toBe(turns.length);
  });

  it("adopts the speaker's open line when no id is known (push-to-talk, no speech_started)", () => {
    let turns = upsertTurn([], "agent", "Go ahead.", "final", "agent:1");
    turns = upsertTurn(turns, "user", "I would like to.", "partial");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "partial");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "final", "user:late-id");

    expect(lines(turns)).toEqual([
      "agent/final: Go ahead.",
      "user/final: I would like to report a claim.",
    ]);
  });

  it("does not commit the same final twice", () => {
    let turns = upsertTurn([], "user", "I would like to report a claim.", "final", "user:a");
    turns = upsertTurn(turns, "user", "I would like to report a claim.", "final", "user:a");
    turns = upsertTurn(turns, "user", "I would like to  report a claim. ", "final");

    expect(lines(turns)).toEqual(["user/final: I would like to report a claim."]);
  });

  it("keeps a genuine repeat that follows a finalized line from the other speaker", () => {
    let turns = upsertTurn([], "user", "Yes.", "final", "user:a");
    turns = upsertTurn(turns, "agent", "Shall I file it?", "final", "agent:1");
    turns = upsertTurn(turns, "user", "Yes.", "final", "user:b");

    expect(lines(turns)).toEqual([
      "user/final: Yes.",
      "agent/final: Shall I file it?",
      "user/final: Yes.",
    ]);
  });

  it("starts a new line for a new utterance once the previous one is final", () => {
    let turns = upsertTurn([], "user", "Hello.", "final", "user:a");
    turns = upsertTurn(turns, "user", "My policy", "partial", "user:b");
    turns = upsertTurn(turns, "user", "My policy number is ACME-1.", "final", "user:b");

    expect(lines(turns)).toEqual(["user/final: Hello.", "user/final: My policy number is ACME-1."]);
  });

  it("ignores empty interim text and keeps existing text on an empty final", () => {
    let turns = upsertTurn([], "user", "   ", "partial", "user:a");
    expect(turns).toEqual([]);
    turns = upsertTurn(turns, "user", "Hi there.", "partial", "user:a");
    turns = upsertTurn(turns, "user", "", "final", "user:a");
    expect(lines(turns)).toEqual(["user/final: Hi there."]);
  });
});
