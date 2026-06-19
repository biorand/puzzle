import type { PuzzleContext, PuzzleModule } from '../types';
import { completePuzzle, makeActions } from './shared';

const SWITCH_COUNT = 5;
const UP_STEP = 36;
const DOWN_STEP = 14;
const START = 0;
const TARGET = 80;
const MIN = 0;
const MAX = 100;

// ── State ──

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let upDown: boolean[] = [];
let switchIdx = 0;
let needle = START;
let won = false;
const playingRef = { value: false };

// ── DOM Refs ──

let needleEl: HTMLDivElement | null = null;
let switchCols: HTMLDivElement[] = [];
let upBtn: HTMLButtonElement | null = null;
let downBtn: HTMLButtonElement | null = null;
let flashEl: HTMLDivElement | null = null;

// ── Render ──

function render(): void {
  if (!needleEl) return;
  const pct = Math.round((needle / MAX) * 100);
  needleEl.style.left = `${pct}%`;

  for (let i = 0; i < SWITCH_COUNT; i++) {
    const col = switchCols[i];
    if (!col) continue;
    col.classList.toggle('pp-active', i === switchIdx && !won);

    const lever = col.querySelector('.pp-lever') as HTMLDivElement;
    if (lever) {
      if (i < upDown.length) {
        lever.classList.toggle('pp-up', upDown[i]);
        lever.classList.toggle('pp-down', !upDown[i]);
        lever.classList.toggle('pp-set', true);
      } else {
        lever.classList.remove('pp-up', 'pp-down', 'pp-set');
      }
    }
  }

  const disabled = switchIdx >= SWITCH_COUNT || won || playingRef.value;
  if (upBtn) upBtn.disabled = disabled;
  if (downBtn) downBtn.disabled = disabled;

  if (ctx) ctx.setStatus({ moves: switchIdx, optimal: SWITCH_COUNT });
}

// ── Game Logic ──

function resetState(): void {
  upDown = [];
  switchIdx = 0;
  needle = START;
  won = false;
  playingRef.value = false;
  render();
}

function generatePuzzle(): void {
  resetState();
}

function flashAndReset(): Promise<void> {
  return new Promise((resolve) => {
    if (!flashEl) {
      resetState();
      resolve();
      return;
    }
    flashEl.style.opacity = '1';
    flashEl.style.transition = 'none';
    void flashEl.offsetWidth;
    flashEl.style.transition = 'opacity 0.5s ease';
    flashEl.style.opacity = '0';
    setTimeout(() => {
      resetState();
      resolve();
    }, 600);
  });
}

function playFailTone(): void {
  try {
    const actx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    if (actx.state === 'suspended') actx.resume();
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    /* audio may not be available */
  }
}

function setActions(): void {
  ctx?.setActions(makeActions(playingRef, generatePuzzle, resetState));
}

async function press(isUp: boolean): Promise<void> {
  if (switchIdx >= SWITCH_COUNT || won || playingRef.value || !ctx) return;
  playingRef.value = true;

  const step = isUp ? UP_STEP : -DOWN_STEP;
  const next = needle + step;

  if (next < MIN || next > MAX) {
    // Move needle to the boundary so the user sees where it went off
    needle = next < MIN ? MIN : MAX;
    render();
    await new Promise((r) => setTimeout(r, 400));
    playFailTone();
    await flashAndReset();
    setActions();
    playingRef.value = false;
    return;
  }

  upDown[switchIdx] = isUp;
  needle = next;
  switchIdx++;
  try {
    ctx.playTone(needle / MAX);
  } catch {
    /* audio may not be available */
  }

  if (switchIdx === SWITCH_COUNT) {
    if (needle === TARGET) {
      won = true;
      render();
      playingRef.value = false;
      await completePuzzle(
        ctx,
        playingRef,
        async () => {
          if (!needleEl) return;
          for (let f = 0; f < 5; f++) {
            needleEl.style.opacity = '0';
            await new Promise((r) => setTimeout(r, 120));
            needleEl.style.opacity = '1';
            await new Promise((r) => setTimeout(r, 120));
          }
        },
        generatePuzzle,
        resetState,
      );
    } else {
      render();
      playingRef.value = false;
      await flashAndReset();
      setActions();
    }
  } else {
    playingRef.value = false;
    render();
  }
}

// ── DOM Build ──

function buildMeter(parent: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.id = 'pp-meter';

  // Labels row (numbers 0-100 every 10)
  const labels = document.createElement('div');
  labels.className = 'pp-meter-labels';
  for (let v = 0; v <= MAX; v += 10) {
    const span = document.createElement('span');
    span.className = 'pp-label';
    if (v === 80) span.classList.add('pp-80');
    span.textContent = String(v);
    span.style.left = `${v}%`;
    labels.appendChild(span);
  }
  wrap.appendChild(labels);

  // Ticks row
  const ticks = document.createElement('div');
  ticks.className = 'pp-meter-ticks';
  for (let v = 0; v <= MAX; v += 10) {
    const tick = document.createElement('div');
    tick.className = 'pp-tick';
    tick.style.left = `${v}%`;
    ticks.appendChild(tick);
  }
  wrap.appendChild(ticks);

  // Track bar
  const track = document.createElement('div');
  track.className = 'pp-meter-track';

  const red = document.createElement('div');
  red.className = 'pp-meter-red';
  track.appendChild(red);

  wrap.appendChild(track);

  // Needle pointer
  const nw = document.createElement('div');
  nw.className = 'pp-needle-wrap';

  needleEl = document.createElement('div');
  needleEl.className = 'pp-needle';
  nw.appendChild(needleEl);

  wrap.appendChild(nw);

  parent.appendChild(wrap);
}

function buildSwitches(parent: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.id = 'pp-switches';

  for (let i = 0; i < SWITCH_COUNT; i++) {
    const col = document.createElement('div');
    col.className = 'pp-switch-col';

    // UP step label
    const ul = document.createElement('div');
    ul.className = 'pp-step pp-step-up';
    ul.textContent = `+${UP_STEP}`;
    col.appendChild(ul);

    // Toggle lever
    const lever = document.createElement('div');
    lever.className = 'pp-lever';
    col.appendChild(lever);

    // DOWN step label
    const dl = document.createElement('div');
    dl.className = 'pp-step pp-step-down';
    dl.textContent = `-${DOWN_STEP}`;
    col.appendChild(dl);

    wrap.appendChild(col);
    switchCols.push(col);
  }

  parent.appendChild(wrap);
}

function buildActions(parent: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.id = 'pp-actions';

  const btns = document.createElement('div');
  btns.id = 'pp-action-btns';

  upBtn = document.createElement('button');
  upBtn.className = 'pp-action-btn pp-btn-up';
  upBtn.textContent = `▲ UP (+${UP_STEP})`;
  upBtn.addEventListener('click', () => press(true));
  btns.appendChild(upBtn);

  downBtn = document.createElement('button');
  downBtn.className = 'pp-action-btn pp-btn-down';
  downBtn.textContent = `▼ DOWN (-${DOWN_STEP})`;
  downBtn.addEventListener('click', () => press(false));
  btns.appendChild(downBtn);

  wrap.appendChild(btns);
  parent.appendChild(wrap);
}

function buildFlash(parent: HTMLElement): void {
  flashEl = document.createElement('div');
  flashEl.id = 'pp-flash';
  parent.appendChild(flashEl);
}

// ── Thumbnail SVG ──

const PP_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="10" y="16" width="100" height="8" rx="2" fill="#555"/>
  <rect x="86" y="16" width="24" height="8" rx="2" fill="#cc0000"/>
  <polygon points="55,14 61,26 49,26" fill="#cc0000"/>
  <text x="28" y="38" text-anchor="middle" fill="#aaa" font-size="6">0</text>
  <text x="60" y="38" text-anchor="middle" fill="#aaa" font-size="6">50</text>
  <text x="96" y="38" text-anchor="middle" fill="#aaa" font-size="6">100</text>
  <rect x="8" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="28" y="52" width="16" height="42" rx="2" fill="#ff6600"/>
  <rect x="48" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="68" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="88" y="52" width="16" height="42" rx="2" fill="#444"/>
  <text x="16" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="36" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="56" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="76" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="96" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="16" y="100" text-anchor="middle" fill="#888" font-size="7">1</text>
  <text x="36" y="100" text-anchor="middle" fill="#888" font-size="7">2</text>
  <text x="56" y="100" text-anchor="middle" fill="#888" font-size="7">3</text>
  <text x="76" y="100" text-anchor="middle" fill="#888" font-size="7">4</text>
  <text x="96" y="100" text-anchor="middle" fill="#888" font-size="7">5</text>
</svg>`;

// ── Module ──

export const powerPanel: PuzzleModule = {
  id: 'powerPanel',
  slug: 'power-panel',
  sourceGame: 're2',
  name: 'Power Panel',
  thumbnail: PP_THUMB,

  create(c: HTMLElement, context: PuzzleContext) {
    container = c;
    ctx = context;

    const layout = document.createElement('div');
    layout.id = 'pp-layout';
    container.appendChild(layout);

    buildMeter(layout);
    buildSwitches(layout);
    buildActions(layout);
    buildFlash(layout);
    generatePuzzle();
    render();
    setActions();

    return {
      destroy(): void {
        switchCols = [];
        needleEl = null;
        upBtn = null;
        downBtn = null;
        flashEl = null;
        container!.innerHTML = '';
        container = null;
        ctx = null;
        upDown = [];
        switchIdx = 0;
        needle = START;
        won = false;
        playingRef.value = false;
      },
    };
  },
};
