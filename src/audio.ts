let audioCtx: AudioContext | null = null;

function initAudio(): AudioContext {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playTone(progress: number): void {
  const ctx = initAudio();
  const now = ctx.currentTime;
  const freq = 200 + progress * 800;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

const NOTE_FREQ: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23,
  G: 392.00, A: 440.00, B: 493.88,
};

export function playMelody(notes: string): Promise<void> {
  const ctx = initAudio();
  const TICK = 0.1;
  let t = ctx.currentTime;

  for (let i = 0; i < notes.length; i++) {
    const ch = notes[i];
    if (ch === '.') {
      t += TICK;
      continue;
    }
    if (/[0-9]/.test(ch)) continue;
    if (/[A-G]/.test(ch) && i + 1 < notes.length && /[0-9]/.test(notes[i + 1])) {
      const note = ch;
      const oct = parseInt(notes[i + 1], 10);
      const base = NOTE_FREQ[note];
      if (base) {
        const freq = base * Math.pow(2, oct - 4);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + TICK);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + TICK);
      }
      t += TICK;
      i++;
    }
  }
  const ms = Math.max(0, (t - ctx.currentTime) * 1000 + 50);
  return new Promise(r => setTimeout(r, ms));
}

export function playChime(): void {
  const ctx = initAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(523, now);
  osc.frequency.setValueAtTime(659, now + 0.15);
  osc.frequency.setValueAtTime(784, now + 0.3);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

export function initAudioOnFirstClick(): void {
  document.addEventListener('click', initAudio, { once: true });
}
