let audioCtx: AudioContext | null = null;

function initAudio(): AudioContext {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function playTone(progress: number): void {
  const ctx = initAudio();
  const now = ctx.currentTime;
  const freq = lerp(400, 1000, progress);
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
  const startTime = ctx.currentTime;
  let maxEnd = startTime;

  // Multi-line chords: each line starts at the same time
  const lines = notes.split('\n');

  // Detect extended syntax (contains spaces or slashes) from any line
  const isExtended = (s: string) => /[\s\/]/.test(s);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isExtended(trimmed)) {
      // Extended syntax: "D5/4 E5/4 G4/4 Z/4" or "D5/1.0 E5/0.5"
      // Volume suffix: "D5/4[0.6]" or "D5/2.0[0.8]"
      const tokens = trimmed.split(/\s+/);
      let t = startTime;

      for (const token of tokens) {
        if (!token) continue;

        // Extract optional volume bracket: D5/4[0.6]
        let volume = 0.2;
        let cleanToken = token;
        const volMatch = token.match(/^(.+?)\[([\d.]+)\]$/);
        if (volMatch) {
          cleanToken = volMatch[1];
          volume = Math.max(0, Math.min(1, parseFloat(volMatch[2]) || 0.2));
        }

        const parts = cleanToken.split('/');
        const pitchPart = parts[0].toUpperCase();
        const durPart = parts[1];

        // Determine duration
        let duration: number;
        if (durPart) {
          const val = parseFloat(durPart);
          if (durPart.includes('.') || val < 1) {
            // Decimal notation: /1.0 = whole, /0.5 = half, /2.0 = double whole
            duration = val * 4 * TICK;
          } else {
            // Denominator notation: /4 = quarter, /8 = eighth, /2 = half
            duration = (4 / val) * TICK;
          }
        } else {
          duration = TICK;
        }

        // Rest (R or Z)
        if (pitchPart === 'R' || pitchPart === 'Z') {
          t += duration;
          continue;
        }

        // Parse note and octave: e.g. "C5", "DS5" (sharp), "EB4" (flat)
        const noteMatch = pitchPart.match(/^([A-G][BS]?)(\d+)$/);
        if (!noteMatch) {
          t += duration;
          continue;
        }

        let noteName = noteMatch[1];
        const oct = parseInt(noteMatch[2], 10);

        // Handle sharps/flats
        if (noteName.length > 1) {
          if (noteName[1] === 'S') {
            // Sharp: e.g. CS5 → C#5
            const baseNote = noteName[0];
            const baseFreq = NOTE_FREQ[baseNote];
            if (baseFreq) {
              const freq = baseFreq * Math.pow(2, oct - 4) * Math.pow(2, 1 / 12);
              playFreq(ctx, freq, t, duration, volume);
            }
            t += duration;
            continue;
          } else if (noteName[1] === 'B') {
            // Flat: e.g. EB4 → Eb4
            const baseNote = noteName[0];
            const baseFreq = NOTE_FREQ[baseNote];
            if (baseFreq) {
              const freq = baseFreq * Math.pow(2, oct - 4) * Math.pow(2, -1 / 12);
              playFreq(ctx, freq, t, duration, volume);
            }
            t += duration;
            continue;
          }
          noteName = noteName[0];
        }

        const base = NOTE_FREQ[noteName];
        if (base) {
          const freq = base * Math.pow(2, oct - 4);
          playFreq(ctx, freq, t, duration, volume);
        }
        t += duration;
      }

      if (t > maxEnd) maxEnd = t;
    } else {
      // Legacy concatenated format: "E4B4G4.E4B4G4"
      // (single line only, no volume support)
      let t = startTime;
      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '.') {
          t += TICK;
          continue;
        }
        if (/[0-9]/.test(ch)) continue;
        if (/[A-G]/.test(ch) && i + 1 < trimmed.length && /[0-9]/.test(trimmed[i + 1])) {
          const note = ch;
          const oct = parseInt(trimmed[i + 1], 10);
          const base = NOTE_FREQ[note];
          if (base) {
            const freq = base * Math.pow(2, oct - 4);
            playFreq(ctx, freq, t, TICK);
          }
          t += TICK;
          i++;
        }
      }
      if (t > maxEnd) maxEnd = t;
    }
  }

  const ms = Math.max(0, (maxEnd - ctx.currentTime) * 1000 + 50);
  return new Promise(r => setTimeout(r, ms));
}

function playFreq(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number = 0.2): void {
  // Bell-like chime: triangle fundamental + quiet harmonic overtone
  const minSustain = 0.35;
  const sustainTime = Math.max(duration * 1.8, minSustain);
  const peakGain = volume;

  // Main oscillator (triangle — warmer, odd harmonics)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;
  gain1.gain.setValueAtTime(0, startTime);
  gain1.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + sustainTime);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(startTime);
  osc1.stop(startTime + sustainTime);

  // Harmonic overtone (sine at ~5th above, adds bell richness)
  const harmonicRatio = 5 / 2; // a perfect twelfth
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = freq * harmonicRatio;
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(peakGain * 0.25, startTime + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + sustainTime * 0.7);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(startTime);
  osc2.stop(startTime + sustainTime);
}

export function playChime(): void {
  const ctx = initAudio();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const step = 0.12;

  for (let i = 0; i < notes.length; i++) {
    const t = now + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = notes[i];
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // Sparkle overtone
  const oscS = ctx.createOscillator();
  const gainS = ctx.createGain();
  oscS.type = 'sine';
  oscS.frequency.value = 2093; // C7
  gainS.gain.setValueAtTime(0, now + 0.25);
  gainS.gain.linearRampToValueAtTime(0.03, now + 0.28);
  gainS.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  oscS.connect(gainS).connect(ctx.destination);
  oscS.start(now + 0.25);
  oscS.stop(now + 0.7);
}

export function initAudioOnFirstClick(): void {
  document.addEventListener('click', initAudio, { once: true });
}
