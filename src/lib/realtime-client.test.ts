import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceSession, type VoiceCallSnapshot } from "./realtime-client";
import { createCall } from "./transcript";
import type { RealtimeEvent } from "./types";

type Internals = {
  handleMessage(raw: unknown): void;
  patch(partial: Partial<VoiceCallSnapshot>): void;
};

function liveSession() {
  const session = new VoiceSession();
  const internals = session as unknown as Internals;
  internals.patch({ status: "live", call: { ...createCall(), status: "live" } });
  return {
    send: (event: RealtimeEvent) => internals.handleMessage(JSON.stringify(event)),
    lines: () =>
      (session.getState().call?.turns ?? []).map(
        (turn) => `${turn.speaker === "agent" ? "Eve" : "Caller"}/${turn.status}: ${turn.text}`,
      ),
    ids: () => (session.getState().call?.turns ?? []).map((turn) => turn.id),
  };
}

const userTranscript = (type: string, transcript: string, item_id?: string) => ({
  type: `conversation.item.input_audio_transcription.${type}`,
  transcript,
  ...(item_id ? { item_id } : {}),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("VoiceSession transcript lines", () => {
  it("writes one caller line per utterance as interim text streams in", () => {
    const { send, lines } = liveSession();
    send({ type: "input_audio_buffer.speech_started", item_id: "item_1" });
    send(userTranscript("updated", "I would like to.", "item_1"));
    send(userTranscript("updated", "I would like to report a claim.", "item_1"));
    send(userTranscript("completed", "I would like to report a claim.", "item_1"));
    send({
      type: "conversation.item.created",
      item: {
        id: "item_1",
        type: "message",
        role: "user",
        content: [{ type: "input_audio", transcript: "I would like to report a claim." }],
      },
    });

    expect(lines()).toEqual(["Caller/final: I would like to report a claim."]);
  });

  it("does the same when events carry no item id", () => {
    const { send, lines } = liveSession();
    send({ type: "input_audio_buffer.speech_started" });
    send(userTranscript("updated", "I would like to."));
    send(userTranscript("updated", "I would like to report a claim."));
    send(userTranscript("completed", "I would like to report a claim."));

    expect(lines()).toEqual(["Caller/final: I would like to report a claim."]);
  });

  it("handles push-to-talk turns that never emit speech_started", () => {
    const { send, lines } = liveSession();
    send(userTranscript("updated", "My policy"));
    send(userTranscript("updated", "My policy number is ACME-1."));
    send(userTranscript("completed", "My policy number is ACME-1.", "item_9"));
    send(userTranscript("updated", "Thanks.", "item_10"));
    send(userTranscript("completed", "Thanks.", "item_10"));

    expect(lines()).toEqual([
      "Caller/final: My policy number is ACME-1.",
      "Caller/final: Thanks.",
    ]);
  });

  it("keeps caller and agent lines separate when a cancelled agent line trails in", () => {
    const { send, lines, ids } = liveSession();
    send({ type: "response.output_audio_transcript.delta", item_id: "eve_1", delta: "Thanks for calling " });
    send({ type: "response.output_audio_transcript.delta", item_id: "eve_1", delta: "Acme, how" });
    send({ type: "input_audio_buffer.speech_started", item_id: "item_1" });
    send(userTranscript("updated", "I would like to.", "item_1"));
    send({ type: "response.output_audio_transcript.done", item_id: "eve_1", transcript: "Thanks for calling Acme, how" });
    send(userTranscript("updated", "I would like to report a claim.", "item_1"));
    send(userTranscript("completed", "I would like to report a claim.", "item_1"));
    send({ type: "response.output_audio_transcript.delta", item_id: "eve_2", delta: "Sure. " });
    send({ type: "response.output_audio_transcript.delta", item_id: "eve_2", delta: "What happened?" });
    send({ type: "response.output_audio_transcript.done", item_id: "eve_2", transcript: "Sure. What happened?" });

    expect(lines()).toEqual([
      "Eve/final: Thanks for calling Acme, how",
      "Caller/final: I would like to report a claim.",
      "Eve/final: Sure. What happened?",
    ]);
    expect(new Set(ids()).size).toBe(3);
  });

  it("streams agent deltas onto one line without losing spaces", () => {
    const { send, lines } = liveSession();
    send({ type: "response.audio_transcript.delta", delta: "Hello " });
    send({ type: "response.audio_transcript.delta", delta: "there, " });
    send({ type: "response.audio_transcript.delta", delta: "this is Eve." });
    expect(lines()).toEqual(["Eve/partial: Hello there, this is Eve."]);

    send({ type: "response.audio_transcript.done", transcript: "Hello there, this is Eve." });
    send({
      type: "conversation.item.created",
      item: { type: "message", role: "assistant", content: [{ type: "audio", transcript: "Hello there, this is Eve." }] },
    });
    expect(lines()).toEqual(["Eve/final: Hello there, this is Eve."]);
  });

  it("keeps a genuine repeated answer after the agent asks again", () => {
    const { send, lines } = liveSession();
    send(userTranscript("completed", "Yes.", "item_1"));
    send({ type: "response.output_audio_transcript.done", item_id: "eve_1", transcript: "Shall I file it?" });
    send(userTranscript("completed", "Yes.", "item_2"));

    expect(lines()).toEqual(["Caller/final: Yes.", "Eve/final: Shall I file it?", "Caller/final: Yes."]);
  });
});
