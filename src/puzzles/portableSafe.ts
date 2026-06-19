import type { PuzzleContext, PuzzleModule } from '../types';
import { UMBRELLA_SVG, completePuzzle, makeActions } from './shared';

const GRID_SIZE = 4;
const NUM_BTNS = GRID_SIZE * 2;

let chain = 0;
let startIdx = -1;
let moves = 0;
const playingRef = { value: false };
let mapping: number[] = [];

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let ringLights: HTMLDivElement[] = [];
let ringArrows: HTMLDivElement[] = [];
let gridBtns: HTMLButtonElement[] = [];

function render(): void {
  const inChain = (i: number): boolean => {
    if (chain === 0) return false;
    const end = startIdx + chain;
    if (end <= NUM_BTNS) return mapping[i] >= startIdx && mapping[i] < end;
    return mapping[i] >= startIdx || mapping[i] < end - NUM_BTNS;
  };
  for (let j = 0; j < NUM_BTNS; j++) ringLights[j].classList.remove('chain');
  for (let i = 0; i < NUM_BTNS; i++) {
    const ic = inChain(i);
    if (ic) ringLights[mapping[i]].classList.add('chain');
    gridBtns[i].classList.toggle('pressed', ic);
    gridBtns[i].disabled = ic;
  }
  if (ctx) ctx.setStatus({ moves, optimal: NUM_BTNS * 2 - 2 });
}

function shuffle(a: number[]): number[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePuzzle(): void {
  mapping = shuffle(Array.from({ length: NUM_BTNS }, (_, i) => i));
  chain = 0;
  startIdx = -1;
  moves = 0;
  render();
}

function press(idx: number): void {
  if (playingRef.value || !ctx) return;

  const lightIdx = mapping[idx];

  if (chain === 0) {
    startIdx = lightIdx;
    chain = 1;
    moves++;
    ctx.playTone(chain / NUM_BTNS);
    render();
  } else {
    const expected = (startIdx + chain) % NUM_BTNS;
    if (lightIdx === expected) {
      chain++;
      moves++;
      ctx.playTone(chain / NUM_BTNS);
      render();
      if (chain === NUM_BTNS) completeAnimation();
    } else {
      // Wrong press — reset chain and start a new one from this button
      startIdx = lightIdx;
      chain = 1;
      moves++;
      ctx.playTone(chain / NUM_BTNS);
      render();
    }
  }
}

function resetPuzzle(): void {
  if (playingRef.value) return;
  chain = 0;
  startIdx = -1;
  moves = 0;
  render();
}

async function completeAnimation(): Promise<void> {
  await completePuzzle(
    ctx,
    playingRef,
    async () => {
      for (let i = 0; i < NUM_BTNS; i++) ringLights[i].classList.toggle('chain', i % 2 === 0);

      const melody = ctx!.playMelody('E4B4G4.E4B4G4.E4B4G4F4E4D4');

      const interval = setInterval(() => {
        for (let i = 0; i < NUM_BTNS; i++) ringLights[i].classList.toggle('chain');
      }, 500);

      await melody;
      clearInterval(interval);

      for (let i = 0; i < NUM_BTNS; i++) {
        ringLights[i].classList.remove('chain');
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    generatePuzzle,
    resetPuzzle,
  );
}

function buildRing(): void {
  ringLights = [];
  ringArrows = [];

  const wrap = document.createElement('div');
  wrap.id = 'safe-ring-wrap';

  const inner = document.createElement('div');
  inner.id = 'safe-ring-inner';
  wrap.appendChild(inner);

  const N = NUM_BTNS;
  const cx = 50,
    cy = 50;
  const rLight = 37.27,
    rArrow = 34.55;

  for (let i = 0; i < N; i++) {
    const lightAngle = (360 / N) * (i + 0.5);
    const la = (lightAngle * Math.PI) / 180;
    const lx = cx + rLight * Math.cos(la);
    const ly = cy - rLight * Math.sin(la);

    const light = document.createElement('div');
    light.className = 'safe-light';
    light.style.left = `${lx}%`;
    light.style.top = `${ly}%`;
    inner.appendChild(light);
    ringLights.push(light);

    const arrowAngle = (360 / N) * (i + 1);
    const aa = (arrowAngle * Math.PI) / 180;
    const ax = cx + rArrow * Math.cos(aa);
    const ay = cy - rArrow * Math.sin(aa);

    const arrow = document.createElement('div');
    arrow.className = 'safe-arrow';
    arrow.textContent = '⏏';
    arrow.style.left = `${ax}%`;
    arrow.style.top = `${ay}%`;
    arrow.style.transform = `rotate(${-arrowAngle}deg)`;
    inner.appendChild(arrow);
    ringArrows.push(arrow);
  }

  const logo = document.createElement('div');
  logo.id = 'umbrella-logo';
  logo.style.width = `66%`;
  logo.style.height = `66%`;
  logo.innerHTML = UMBRELLA_SVG;
  inner.appendChild(logo);

  container!.appendChild(wrap);
}

function buildGrid(): void {
  gridBtns = [];

  const grid = document.createElement('div');
  grid.id = 'safe-grid';

  for (let row = 0; row < GRID_SIZE; row++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'safe-row';
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const btn = document.createElement('button');
      btn.className = 'safe-btn';
      btn.textContent = String(idx + 1);
      btn.addEventListener('click', () => press(idx));
      rowDiv.appendChild(btn);
      gridBtns.push(btn);
    }
    grid.appendChild(rowDiv);
  }

  container!.appendChild(grid);
}

const SAFE_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="50" stroke="#555" stroke-width="5"/>
  <circle cx="60" cy="60" r="35" stroke="#ff6600" stroke-width="4"/>
  <circle cx="60" cy="60" r="8" fill="#ff6600"/>
  <line x1="60" y1="10" x2="60" y2="22" stroke="#ff6600" stroke-width="3"/>
  <line x1="60" y1="98" x2="60" y2="110" stroke="#555" stroke-width="3"/>
  <line x1="10" y1="60" x2="22" y2="60" stroke="#555" stroke-width="3"/>
  <line x1="98" y1="60" x2="110" y2="60" stroke="#555" stroke-width="3"/>
  <line x1="25" y1="25" x2="33" y2="33" stroke="#555" stroke-width="2"/>
  <line x1="95" y1="25" x2="87" y2="33" stroke="#555" stroke-width="2"/>
  <line x1="95" y1="95" x2="87" y2="87" stroke="#555" stroke-width="2"/>
  <line x1="25" y1="95" x2="33" y2="87" stroke="#555" stroke-width="2"/>
</svg>`;

export const portableSafe: PuzzleModule = {
  id: 'portableSafe',
  slug: 'portable-safe',
  sourceGame: 're2r',
  name: 'Portable Safe',
  thumbnail: SAFE_THUMB,

  create(c: HTMLElement, context: PuzzleContext) {
    container = c;
    ctx = context;

    ringLights = [];
    ringArrows = [];
    buildRing();
    buildGrid();
    generatePuzzle();

    ctx.setActions(makeActions(playingRef, generatePuzzle, resetPuzzle));

    return {
      destroy(): void {
        ringLights = [];
        ringArrows = [];
        gridBtns = [];
        container!.innerHTML = '';
        container = null;
        ctx = null;
        playingRef.value = false;
      },
    };
  },
};
