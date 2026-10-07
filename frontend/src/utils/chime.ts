// A short two-beep sound, generated in the browser (no audio file needed).
export function playChime() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch {
    // Sound is a bonus; ignore if the browser blocks it.
  }
}
