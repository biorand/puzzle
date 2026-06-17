let audioCtx: AudioContext | null = null;

function initAudio(): AudioContext {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const DTMF_LOW  = [697, 697, 697, 770, 770, 770, 852, 852, 852];
const DTMF_HIGH = [1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477];

export function playTone(idx: number): void {
  const ctx = initAudio();
  const now = ctx.currentTime;
  for (const freq of [DTMF_LOW[idx], DTMF_HIGH[idx]]) {
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
