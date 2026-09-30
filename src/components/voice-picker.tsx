"use client";

import { useEffect, useState } from "react";
import { BUILT_IN_VOICES, publicPreviewUrl, SWEDISH_VOICE_NOTE, voiceName, type SwedishSupport, type VoiceChoice } from "@/lib/voices";

type VoiceCatalogResponse = {
  configured?: boolean;
  swedishNote?: string;
  warning?: string;
  voices?: VoiceChoice[];
};

const SWEDISH_COPY: Record<SwedishSupport, string> = {
  listed: "Swedish listed by xAI",
  multilingual: "Swedish: multilingual, not ranked",
  unspecified: "Swedish: not specified",
};

function previewUrlFor(voice: VoiceChoice) {
  return publicPreviewUrl(voice.previewUrl);
}

type Playback = { audio: HTMLAudioElement; url?: string; key: string };

let playback: Playback | null = null;
let playbackGeneration = 0;

function stopPlayback() {
  playbackGeneration += 1;
  const current = playback;
  playback = null;
  current?.audio.pause();
  if (current?.url) URL.revokeObjectURL(current.url);
}

export function VoicePicker({
  voiceId,
  onSelect,
}: {
  voiceId: string;
  onSelect: (id: string) => void;
}) {
  const [voices, setVoices] = useState(BUILT_IN_VOICES);
  const [configured, setConfigured] = useState(false);
  const [swedishNote, setSwedishNote] = useState(SWEDISH_VOICE_NOTE);
  const [warning, setWarning] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/voices", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((payload: VoiceCatalogResponse) => {
        if (Array.isArray(payload.voices) && payload.voices.length > 0) {
          setVoices(payload.voices);
        }
        setConfigured(payload.configured === true);
        if (payload.swedishNote) setSwedishNote(payload.swedishNote);
        setWarning(payload.warning ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWarning("Could not refresh the voice list. Showing the built-in roster.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => stopPlayback(), []);

  const listed = voices.some((voice) => voice.id === voiceId)
    ? voices
    : [
        {
          id: voiceId,
          name: voiceName(voiceId),
          languages: [],
          swedish: "unspecified" as const,
        },
        ...voices,
      ];

  async function play(voice: VoiceChoice, language: "en" | "sv") {
    const key = `${voice.id}:${language}`;
    if (playing === key) {
      stopPlayback();
      setPlaying(null);
      return;
    }
    stopPlayback();
    setPlaying(null);
    setWarning(null);
    const generation = playbackGeneration;
    const published = language === "en" ? previewUrlFor(voice) : undefined;
    const audio = new Audio();

    try {
      let url: string | undefined;
      if (published) {
        audio.src = published;
      } else {
        const response = await fetch(
          `/api/voices/preview?voice=${encodeURIComponent(voice.id)}&lang=${language}`,
        );
        if (generation !== playbackGeneration) return;
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setWarning(payload.error ?? "Could not play that sample.");
          return;
        }
        url = URL.createObjectURL(await response.blob());
        audio.src = url;
      }
      if (generation !== playbackGeneration) {
        audio.pause();
        if (url) URL.revokeObjectURL(url);
        return;
      }
      playback = { audio, url, key };
      audio.onended = () => {
        if (playback?.audio !== audio) return;
        if (url) URL.revokeObjectURL(url);
        playback = null;
        setPlaying((current) => (current === key ? null : current));
      };
      await audio.play();
      setPlaying(key);
    } catch {
      stopPlayback();
      setWarning("Could not play that sample.");
    }
  }

  return (
    <fieldset className="settings-voices">
      <legend className="settings-label">Agent voice</legend>
      <p className="settings-help">
        Saved in this browser as <code>acme-intake-voice</code>. The next Call
        sends it on <code>session.update</code>. The intake persona in the
        prompt stays as written.
      </p>
      <p className="settings-help">{swedishNote}</p>
      {configured ? null : (
        <p className="settings-help">
          Published samples still play. Synthesized English and Swedish samples
          need <code>XAI_API_KEY</code> on the server. The key never reaches
          this page.
        </p>
      )}
      <ul className="settings-voice-list">
        {listed.map((voice) => {
          const meta = [voice.gender, voice.tone, voice.accent].filter(Boolean).join(" · ");
          const published = previewUrlFor(voice);
          const englishDisabled = !published && !configured;
          return (
            <li
              key={voice.id}
              className={voice.id === voiceId ? "settings-voice is-current" : "settings-voice"}
            >
              <label>
                <input
                  type="radio"
                  name="agent-voice"
                  value={voice.id}
                  checked={voice.id === voiceId}
                  onChange={() => onSelect(voice.id)}
                />
                <span>
                  <strong>
                    {voice.name}
                    {voice.id === voiceId ? " · In use" : ""}
                  </strong>
                  {meta ? <span className="settings-voice-meta">{meta}</span> : null}
                  {voice.description ? (
                    <span className="settings-voice-meta">{voice.description}</span>
                  ) : null}
                  <span className="settings-voice-meta">{SWEDISH_COPY[voice.swedish]}</span>
                </span>
              </label>
              <span className="settings-voice-actions">
                <button
                  type="button"
                  className="settings-voice-play"
                  disabled={englishDisabled}
                  aria-label={
                    published ? `Play ${voice.name}'s published sample` : `Play ${voice.name} in English`
                  }
                  title={
                    englishDisabled
                      ? "Add XAI_API_KEY on the server to synthesize a sample."
                      : published
                        ? "Play xAI's published sample"
                        : "Synthesize a short English sample"
                  }
                  onClick={() => void play(voice, "en")}
                >
                  {playing === `${voice.id}:en` ? "Stop" : "Play"}
                </button>
                <button
                  type="button"
                  className="settings-voice-play"
                  disabled={!configured}
                  aria-label={`Play ${voice.name} in Swedish`}
                  title={
                    configured
                      ? "Synthesize a short Swedish sample"
                      : "Add XAI_API_KEY on the server to synthesize a Swedish sample."
                  }
                  onClick={() => void play(voice, "sv")}
                >
                  {playing === `${voice.id}:sv` ? "Stop" : "Svenska"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {warning ? (
        <p className="settings-status" role="status">
          {warning}
        </p>
      ) : null}
    </fieldset>
  );
}
