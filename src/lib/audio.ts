export const TARGET_SAMPLE_RATE = 24_000;
const SEND_CHUNK_MS = 100;

export function resampleFloat32(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const srcIndex = i * ratio;
    const i0 = Math.min(Math.floor(srcIndex), input.length - 1);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIndex - i0;
    output[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return output;
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export function pcm16ToFloat32(pcm: Int16Array): Float32Array {
  const output = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    output[i] = (pcm[i] ?? 0) / 32768;
  }
  return output;
}

export class PcmPlayer {
  private context: AudioContext;
  private gain: GainNode;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  constructor(sampleRate = TARGET_SAMPLE_RATE) {
    this.context = new AudioContext({ sampleRate });
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
  }

  get sampleRate() {
    return this.context.sampleRate;
  }

  async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  enqueue(pcm: Int16Array) {
    if (pcm.length === 0) return;
    let samples = pcm16ToFloat32(pcm);
    if (this.context.sampleRate !== TARGET_SAMPLE_RATE) {
      samples = resampleFloat32(samples, TARGET_SAMPLE_RATE, this.context.sampleRate);
    }
    const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    const now = this.context.currentTime;
    if (this.nextTime < now) {
      this.nextTime = now;
    }
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source);
    };
  }

  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
    this.nextTime = this.context.currentTime;
  }

  async drain() {
    const remaining = Math.max(0, this.nextTime - this.context.currentTime);
    if (remaining > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, Math.ceil(remaining * 1000)));
    }
  }

  async close() {
    this.interrupt();
    await this.context.close().catch(() => undefined);
  }
}

type MicCaptureHandlers = {
  onChunk: (base64Pcm: string) => void;
  onLevel?: (level: number) => void;
};

export class MicCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private worklet: AudioWorkletNode | ScriptProcessorNode | null = null;
  private pending = new Float32Array(0);
  private muted = false;
  private handlers: MicCaptureHandlers;

  constructor(handlers: MicCaptureHandlers) {
    this.handlers = handlers;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    this.context = context;
    if (context.state === "suspended") {
      await context.resume();
    }

    const source = context.createMediaStreamSource(this.stream);
    const silent = context.createGain();
    silent.gain.value = 0;

    try {
      await context.audioWorklet.addModule("/pcm-capture-worklet.js");
      const worklet = new AudioWorkletNode(context, "pcm-capture");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        this.handleSamples(event.data, context.sampleRate);
      };
      source.connect(worklet);
      worklet.connect(silent);
      silent.connect(context.destination);
      this.worklet = worklet;
    } catch {
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        this.handleSamples(event.inputBuffer.getChannelData(0), context.sampleRate);
      };
      source.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      this.worklet = processor;
    }
  }

  private handleSamples(raw: Float32Array, sampleRate: number) {
    if (this.muted) {
      this.handlers.onLevel?.(0);
      return;
    }

    let samples = raw;
    if (sampleRate !== TARGET_SAMPLE_RATE) {
      samples = resampleFloat32(raw, sampleRate, TARGET_SAMPLE_RATE);
    }

    const merged = new Float32Array(this.pending.length + samples.length);
    merged.set(this.pending);
    merged.set(samples, this.pending.length);

    const chunkSize = Math.round((TARGET_SAMPLE_RATE * SEND_CHUNK_MS) / 1000);
    let offset = 0;
    while (merged.length - offset >= chunkSize) {
      const slice = merged.subarray(offset, offset + chunkSize);
      this.handlers.onLevel?.(rms(slice));
      this.handlers.onChunk(pcm16ToBase64(floatToPcm16(slice)));
      offset += chunkSize;
    }
    this.pending = merged.subarray(offset);
  }

  async stop() {
    this.worklet?.disconnect();
    this.worklet = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.pending = new Float32Array(0);
  }
}

function rms(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
