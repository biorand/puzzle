import type { PuzzleContext, PuzzleModule } from '../types';
import { completePuzzle, makeActions, sleep } from './shared';

interface Bottle {
  id: number;
  value: number;
  name: string;
  colorClass: string;
}

interface BaseChem {
  name: string;
  value: number;
  colorClass: string;
  label: string;
}

interface Equation {
  leftA: number;
  leftB: number;
  result: number;
}

interface PuzzleConfig {
  bases: [BaseChem, BaseChem, BaseChem];
  equations: Equation[];
  target: number;
}

const SLOTS = 4;

function getNameForValue(value: number, target: number): string {
  if (value === target) return 'V-JOLT';
  if (value >= 15) return `VP-${value}`;
  if (value >= 10) return `UMB No.${value}`;
  if (value >= 7) return `UMB No.${value}`;
  if (value >= 4) return `NP-00${value}`;
  return `Cmpd #${value}`;
}

function getColorClass(value: number, target: number): string {
  if (value === target) return 'vjolt-brown';
  if (value >= 15) return 'vjolt-darkblue';
  if (value >= 10) return 'vjolt-orange';
  if (value >= 7) return 'vjolt-green';
  if (value >= 4) return 'vjolt-purple';
  return 'vjolt-gray';
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generatePuzzle(): PuzzleConfig {
  const w = randomInt(1, 3);
  const r = randomInt(2, 5);
  const y = randomInt(3, 7);

  const bases: [BaseChem, BaseChem, BaseChem] = [
    { name: 'Water', value: w, colorClass: 'vjolt-blue', label: 'Water' },
    { name: 'UMB No.3', value: r, colorClass: 'vjolt-red', label: 'UMB #3' },
    { name: 'Yellow-6', value: y, colorClass: 'vjolt-yellow', label: 'Yel-6' },
  ];

  const d = w + r;
  const e = d + y;
  const f = w + y;
  const g = e + f;
  const target = g + r;

  const equations: Equation[] = [
    { leftA: w, leftB: r, result: d },
    { leftA: d, leftB: y, result: e },
    { leftA: w, leftB: y, result: f },
    { leftA: e, leftB: f, result: g },
    { leftA: g, leftB: r, result: target },
  ];

  return { bases, equations, target };
}

function optimalMoves(): number {
  return 12;
}

// ─── Module State ────────────────────────────────────────────────────

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let config: PuzzleConfig | null = null;
let slots: (Bottle | null)[] = [];
let nextId = 1;
let selectedIdx: number | null = null;
let moves = 0;
let won = false;
const playingRef = { value: false };
let bottleEls: HTMLElement[] = [];
let testBtn: HTMLButtonElement | null = null;
let discardBtn: HTMLButtonElement | null = null;

// ─── Rendering ───────────────────────────────────────────────────────

function updateButtons(): void {
  if (!testBtn || !discardBtn) return;
  const hasSelected = selectedIdx !== null && slots[selectedIdx] !== null;
  testBtn.disabled = !hasSelected;
  discardBtn.disabled = !hasSelected;
}

function render(): void {
  for (let i = 0; i < SLOTS; i++) {
    const el = bottleEls[i];
    if (!el) continue;
    const b = slots[i];
    if (b) {
      el.className = `vjolt-bottle ${b.colorClass}`;
      if (selectedIdx === i) el.classList.add('selected');
      const nameEl = el.querySelector('.vjolt-bottle-name') as HTMLElement;
      if (nameEl) nameEl.textContent = b.name;
      const valEl = el.querySelector('.vjolt-bottle-value') as HTMLElement;
      if (valEl) valEl.textContent = `#${b.value}`;
    } else {
      el.className = 'vjolt-bottle empty';
      const nameEl = el.querySelector('.vjolt-bottle-name') as HTMLElement;
      if (nameEl) nameEl.textContent = '';
      const valEl = el.querySelector('.vjolt-bottle-value') as HTMLElement;
      if (valEl) valEl.textContent = '';
    }
  }
  updateButtons();
  if (ctx) ctx.setStatus({ moves, optimal: optimalMoves() });
}

function buildWall(): void {
  if (!container || !config) return;
  const wall = document.createElement('div');
  wall.className = 'vjolt-wall';

  const eqWrap = document.createElement('div');
  eqWrap.className = 'vjolt-equations';
  for (const eq of config.equations) {
    const span = document.createElement('span');
    span.className = 'vjolt-equation';
    span.textContent = `${eq.leftA}+${eq.leftB}=${eq.result}`;
    eqWrap.appendChild(span);
  }
  wall.appendChild(eqWrap);

  const hr = document.createElement('hr');
  hr.className = 'vjolt-hr';
  wall.appendChild(hr);

  const legend = document.createElement('div');
  legend.className = 'vjolt-legend';
  for (const base of config.bases) {
    const entry = document.createElement('span');
    entry.className = `vjolt-legend-entry ${base.colorClass}`;
    entry.textContent = `${base.label}=${base.value}`;
    legend.appendChild(entry);
  }
  wall.appendChild(legend);

  container.appendChild(wall);
}

function buildShelf(): void {
  if (!container || !config) return;
  const shelf = document.createElement('div');
  shelf.className = 'vjolt-shelf';

  for (let i = 0; i < config.bases.length; i++) {
    const base = config.bases[i];
    const btn = document.createElement('button');
    btn.className = `vjolt-shelf-btn ${base.colorClass}`;
    btn.dataset.idx = String(i);

    const name = document.createElement('span');
    name.className = 'vjolt-shelf-name';
    name.textContent = base.label;
    btn.appendChild(name);

    btn.addEventListener('click', () => handleFill(i));
    shelf.appendChild(btn);
  }

  container.appendChild(shelf);
}

function buildWorkbench(): void {
  if (!container) return;
  const wb = document.createElement('div');
  wb.className = 'vjolt-workbench';

  for (let i = 0; i < SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'vjolt-bottle empty';
    slot.dataset.idx = String(i);

    const fill = document.createElement('div');
    fill.className = 'vjolt-bottle-fill';
    slot.appendChild(fill);

    const name = document.createElement('div');
    name.className = 'vjolt-bottle-name';
    slot.appendChild(name);

    const val = document.createElement('div');
    val.className = 'vjolt-bottle-value';
    slot.appendChild(val);

    slot.addEventListener('click', () => handleBottleClick(i));
    wb.appendChild(slot);
    bottleEls.push(slot);
  }

  container.appendChild(wb);
}

function buildActions(): void {
  if (!container) return;
  const actions = document.createElement('div');
  actions.className = 'vjolt-actions';

  testBtn = document.createElement('button');
  testBtn.className = 'vjolt-btn vjolt-btn-test';
  testBtn.textContent = 'TEST';
  testBtn.disabled = true;
  testBtn.addEventListener('click', handleTest);
  actions.appendChild(testBtn);

  discardBtn = document.createElement('button');
  discardBtn.className = 'vjolt-btn vjolt-btn-discard';
  discardBtn.textContent = 'DISCARD';
  discardBtn.disabled = true;
  discardBtn.addEventListener('click', handleDiscard);
  actions.appendChild(discardBtn);

  container.appendChild(actions);
}

// ─── Actions ─────────────────────────────────────────────────────────

function handleFill(baseIdx: number): void {
  if (won || playingRef.value || !config) return;
  const emptyIdx = slots.indexOf(null);
  if (emptyIdx === -1) return;

  const base = config.bases[baseIdx];
  slots[emptyIdx] = {
    id: nextId++,
    value: base.value,
    name: getNameForValue(base.value, config.target),
    colorClass: base.colorClass,
  };
  moves++;
  ctx?.playTone(0.3);
  render();
}

function handleBottleClick(idx: number): void {
  if (won || playingRef.value) return;
  if (idx >= slots.length || slots[idx] === null) return;

  if (selectedIdx === idx) {
    selectedIdx = null;
    render();
    return;
  }

  if (selectedIdx !== null) {
    const a = selectedIdx;
    const b = idx;
    const bottleA = slots[a];
    const bottleB = slots[b];
    if (!bottleA || !bottleB) return;

    selectedIdx = null;
    const newValue = bottleA.value + bottleB.value;

    slots[a] = null;
    slots[b] = null;
    const emptyIdx = slots.indexOf(null);
    slots[emptyIdx] = {
      id: nextId++,
      value: newValue,
      name: getNameForValue(newValue, config!.target),
      colorClass: getColorClass(newValue, config!.target),
    };

    moves++;
    ctx?.playTone(0.5);

    if (newValue === config?.target) {
      won = true;
      triggerWin();
      return;
    }

    render();
  } else {
    selectedIdx = idx;
    render();
  }
}

function handleTest(): void {
  if (won || playingRef.value || selectedIdx === null) return;
  const b = slots[selectedIdx];
  if (!b || !config) return;

  if (b.value === config.target) {
    won = true;
    triggerWin();
  } else {
    ctx?.playTone(0.1);
    const el = bottleEls[selectedIdx];
    if (el) {
      el.classList.add('wrong');
      setTimeout(() => el.classList.remove('wrong'), 400);
    }
  }
}

function handleDiscard(): void {
  if (won || playingRef.value || selectedIdx === null) return;
  if (slots[selectedIdx] === null) return;

  slots[selectedIdx] = null;
  selectedIdx = null;
  moves++;
  ctx?.playTone(0.15);
  render();
}

// ─── Win ─────────────────────────────────────────────────────────────

async function triggerWin(): Promise<void> {
  if (!ctx || !config) return;
  playingRef.value = true;
  ctx.setActions([]);

  const targetIdx = slots.findIndex((s) => s?.value === config!.target);
  if (targetIdx >= 0) {
    const el = bottleEls[targetIdx];
    if (el) el.classList.add('win');
  }

  ctx.playChime();
  await sleep(600);

  await completePuzzle(ctx, playingRef, async () => {}, newPuzzle, restartPuzzle, false);
}

// ─── Game lifecycle ──────────────────────────────────────────────────

function restartPuzzle(): void {
  slots = [null, null, null, null];
  nextId = 1;
  selectedIdx = null;
  moves = 0;
  won = false;
  render();
}

function newPuzzle(): void {
  config = generatePuzzle();
  restartPuzzle();
}

// ─── Thumbnail ───────────────────────────────────────────────────────

const THUMBNAIL = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="15" y="10" width="90" height="60" rx="4" stroke="#888" stroke-width="2" fill="none"/>
  <text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">1+3=4</text>
  <text x="60" y="44" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">4+6=10</text>
  <text x="60" y="58" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">10+7=17</text>
  <rect x="30" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#4488ff" opacity="0.5"/>
  <rect x="52" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#ff4444" opacity="0.5"/>
  <rect x="74" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#ffcc00" opacity="0.5"/>
  <text x="39" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">W</text>
  <text x="61" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">R</text>
  <text x="83" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">Y</text>
</svg>`;

// ─── Module Export ───────────────────────────────────────────────────

export const vjolt: PuzzleModule = {
  id: 'vjolt',
  slug: 'v-jolt',
  sourceGame: 're1r',
  name: 'V-JOLT',
  thumbnail: THUMBNAIL,

  create(c: HTMLElement, context: PuzzleContext) {
    container = c;
    ctx = context;

    config = generatePuzzle();
    slots = [null, null, null, null];
    nextId = 1;
    selectedIdx = null;
    moves = 0;
    won = false;
    bottleEls = [];
    testBtn = null;
    discardBtn = null;

    buildWall();
    buildShelf();
    buildWorkbench();
    buildActions();
    render();

    ctx.setActions(makeActions(playingRef, newPuzzle, restartPuzzle));

    return {
      destroy(): void {
        slots = [];
        bottleEls = [];
        testBtn = null;
        discardBtn = null;
        container!.innerHTML = '';
        container = null;
        ctx = null;
        config = null;
        won = false;
      },
    };
  },
};

// Exports for testing
export { generatePuzzle, optimalMoves, SLOTS, getNameForValue, getColorClass };
export type { Bottle, PuzzleConfig, Equation, BaseChem };
