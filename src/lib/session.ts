export const AGENT_VOICE = "eve";
export const REALTIME_MODEL = "grok-voice-latest";
export const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${REALTIME_MODEL}`;
export const TARGET_SAMPLE_RATE = 24_000;

export const INTAKE_INSTRUCTIONS = `You are an intake specialist at Acme Insurance. You are on a live phone call with a person who just connected.

Role
Greet the caller, learn why they called, and collect just enough detail for a human teammate to continue. You do not file claims, bind coverage, quote prices, or look up real policies.

Style
Speak in short, calm sentences. Ask one question at a time. Sound like a careful call-center person, not a chatbot. Keep answers brief so they are easy to hear.

Intake
1. Greet them as Acme Insurance intake and ask how you can help today.
2. Capture intent: new quote, existing policy question, billing, a possible claim, or something else.
3. If they volunteer it, note their name, a callback number, a policy or claim number, and a short description of what happened.
4. Never ask for a full Social Security number, card number, password, or bank login.
5. If they need something you cannot do, say you will pass the notes to a licensed teammate.

Start
When the call connects, greet them first. Do not wait for them to speak.`;

export function buildSessionUpdate(instructions = INTAKE_INSTRUCTIONS) {
  return {
    type: "session.update",
    session: {
      voice: AGENT_VOICE,
      instructions,
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
      },
      audio: {
        input: {
          format: { type: "audio/pcm", rate: TARGET_SAMPLE_RATE },
          transcription: {
            model: "grok-transcribe",
            language_hint: "en",
          },
        },
        output: {
          format: { type: "audio/pcm", rate: TARGET_SAMPLE_RATE },
        },
      },
    },
  };
}
