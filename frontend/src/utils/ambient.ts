export type AmbientKind = "rain" | "ocean" | "white" | "brown" | "fan";

export const AMBIENT_SOUNDS: { id: AmbientKind; emoji: string; label: string }[] = [
  { id: "rain", emoji: "🌧️", label: "Rain" },
  { id: "ocean", emoji: "🌊", label: "Waves" },
  { id: "brown", emoji: "🟤", label: "Deep focus" },
  { id: "white", emoji: "⚪", label: "White noise" },
  { id: "fan", emoji: "🌀", label: "Fan" },
];

type NoiseColour = "white" | "pink" | "brown";

// Makes a few seconds of random noise that can loop forever
function noiseBuffer(ctx: AudioContext, colour: NoiseColour, seconds = 10) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (colour === "white") {
      data[i] = white;
    } else if (colour === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // pink noise
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
}

// Builds relaxing background sounds out of filtered noise (no audio files needed)
export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private extras: AudioNode[] = [];
  private volume = 0.5;
  private playing = false;
  private stopTimer: number | null = null;

  private ensure() {
    if (!this.ctx || !this.master) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return { ctx: this.ctx, master: this.master };
  }

  private loop(ctx: AudioContext, colour: NoiseColour) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, colour);
    source.loop = true;
    this.sources.push(source);
    return source;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    this.extras.push(node);
    return node;
  }

  private gain(ctx: AudioContext, value: number) {
    const node = ctx.createGain();
    node.gain.value = value;
    this.extras.push(node);
    return node;
  }

  private clearSources() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
      s.disconnect();
    }
    for (const n of this.extras) n.disconnect();
    this.sources = [];
    this.extras = [];
  }

  start(kind: AmbientKind) {
    const { ctx, master } = this.ensure();
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.clearSources();

    if (kind === "white") {
      const g = this.gain(ctx, 0.3);
      this.loop(ctx, "white").connect(g);
      g.connect(master);
    } else if (kind === "brown") {
      const g = this.gain(ctx, 0.9);
      this.loop(ctx, "brown").connect(g);
      g.connect(master);
    } else if (kind === "rain") {
      // a soft rushing layer plus a faint sparkle on top
      const base = this.loop(ctx, "pink");
      const hp = this.filter(ctx, "highpass", 400);
      const lp = this.filter(ctx, "lowpass", 6000);
      const baseGain = this.gain(ctx, 0.8);
      base.connect(hp);
      hp.connect(lp);
      lp.connect(baseGain);
      baseGain.connect(master);

      const spark = this.loop(ctx, "white");
      const sparkHp = this.filter(ctx, "highpass", 5000);
      const sparkGain = this.gain(ctx, 0.05);
      spark.connect(sparkHp);
      sparkHp.connect(sparkGain);
      sparkGain.connect(master);
    } else if (kind === "ocean") {
      // low rumble that swells slowly, like waves
      const src = this.loop(ctx, "brown");
      const lp = this.filter(ctx, "lowpass", 900);
      const waves = this.gain(ctx, 0.55);
      src.connect(lp);
      lp.connect(waves);
      waves.connect(master);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const depth = this.gain(ctx, 0.4);
      lfo.connect(depth);
      depth.connect(waves.gain);
      lfo.start();
      this.sources.push(lfo);
    } else {
      // fan: steady hum
      const src = this.loop(ctx, "pink");
      const bp = this.filter(ctx, "bandpass", 500, 0.7);
      const g = this.gain(ctx, 1.3);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
    }

    for (const s of this.sources) s.start();

    this.playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.4); // gentle fade in
  }

  stop() {
    if (!this.ctx || !this.master) return;
    this.playing = false;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); // gentle fade out
    this.stopTimer = window.setTimeout(() => {
      this.clearSources();
      this.stopTimer = null;
    }, 500);
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.playing && this.ctx && this.master) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    }
  }

  dispose() {
    this.clearSources();
    if (this.stopTimer !== null) window.clearTimeout(this.stopTimer);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.playing = false;
  }
}
