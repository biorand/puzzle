import type { PuzzleContext, PuzzleModule } from '../types';
import { completePuzzle, makeActions, sleep } from './shared';

interface Bottle {
  id: number;
  value: number;
  name: string;
  colorClass: string;
  isPoison: boolean;
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
  validPairs: string[];
}

const SLOTS = 4;
const nameCache = new Map<number, string>();

function makeChemicalName(value: number, target: number): string {
  if (value === target) return 'V-JOLT';
  if (value === 1) return 'Water';

  if (value === 3) return 'UMB No.3';
  if (value === 4) return 'NP-004';
  if (value === 6) return 'Yellow-6';
  if (value === 7) return 'UMB No.7';
  if (value === 10) return 'UMB No.10';
  if (value === 17) return 'VP-017';

  const patterns: Array<(v: number) => string> = [
    (v) => `UMB No.${v}`,
    (v) => `NP-${String(v).padStart(3, '0')}`,
    (v) => `Yellow-${v}`,
    (v) => `VP-${String(v).padStart(3, '0')}`,
  ];

  return patterns[Math.floor(Math.random() * patterns.length)](value);
}

function getNameForValue(value: number, target: number): string {
  const cached = nameCache.get(value);
  if (cached) return cached;
  const name = makeChemicalName(value, target);
  nameCache.set(value, name);
  return name;
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

function pairKey(a: number, b: number): string {
  const [low, high] = a < b ? [a, b] : [b, a];
  return `${low},${high}`;
}

const TEMPLATES: Array<(w: number, r: number, y: number) => [Equation[], number[]]> = [
  // A: Water + Yellow first
  (w, r, y) => {
    const d = w + y;
    const e = r + y;
    const f = d + e;
    const g = f + y;
    const target = g + r;
    return [
      [
        { leftA: w, leftB: y, result: d },
        { leftA: r, leftB: y, result: e },
        { leftA: d, leftB: e, result: f },
        { leftA: f, leftB: y, result: g },
        { leftA: g, leftB: r, result: target },
      ],
      [d, e, f, g, target],
    ];
  },
  // B: Water + Red first
  (w, r, y) => {
    const d = w + r;
    const e = d + y;
    const f = r + y;
    const g = e + f;
    const target = g + w;
    return [
      [
        { leftA: w, leftB: r, result: d },
        { leftA: d, leftB: y, result: e },
        { leftA: r, leftB: y, result: f },
        { leftA: e, leftB: f, result: g },
        { leftA: g, leftB: w, result: target },
      ],
      [d, e, f, g, target],
    ];
  },
  // C: Red + Yellow first
  (w, r, y) => {
    const d = r + y;
    const e = w + d;
    const f = e + y;
    const g = f + r;
    const target = g + w;
    return [
      [
        { leftA: r, leftB: y, result: d },
        { leftA: w, leftB: d, result: e },
        { leftA: e, leftB: y, result: f },
        { leftA: f, leftB: r, result: g },
        { leftA: g, leftB: w, result: target },
      ],
      [d, e, f, g, target],
    ];
  },
];

function generatePuzzle(): PuzzleConfig {
  const w = 1;
  const r = randomInt(2, 4);
  const yMin = Math.max(r + 1, 4);
  const y = randomInt(yMin, 7);

  const templateIdx = Math.floor(Math.random() * TEMPLATES.length);
  const [equations, results] = TEMPLATES[templateIdx](w, r, y);
  const target = results[results.length - 1];

  // Validate: no equation result equals a base compound value
  const baseVals = [w, r, y];
  for (const v of results) {
    if (baseVals.includes(v)) {
      nameCache.clear();
      return generatePuzzle(); // retry
    }
  }

  // Pre-populate name cache so all values get consistent names
  for (const v of [w, r, y, ...results]) {
    getNameForValue(v, target);
  }

  const bases: [BaseChem, BaseChem, BaseChem] = [
    { name: 'Water', value: w, colorClass: 'vjolt-blue', label: 'Water' },
    { name: nameCache.get(r)!, value: r, colorClass: 'vjolt-red', label: nameCache.get(r)! },
    { name: nameCache.get(y)!, value: y, colorClass: 'vjolt-yellow', label: nameCache.get(y)! },
  ];

  const pairSet = new Set<string>();
  for (const eq of equations) {
    pairSet.add(pairKey(eq.leftA, eq.leftB));
  }
  const validPairs = Array.from(pairSet);

  return { bases, equations, target, validPairs };
}

function optimalMoves(): number {
  return 11;
}

// ─── Module State ────────────────────────────────────────────────────

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let config: PuzzleConfig | null = null;
let slots: (Bottle | null)[] = [];
let nextId = 1;
let selectedIdxs: number[] = [];
let moves = 0;
let won = false;
const playingRef = { value: false };
let bottleEls: HTMLElement[] = [];
let combineBtn: HTMLButtonElement | null = null;
let discardBtn: HTMLButtonElement | null = null;

// ─── Rendering ───────────────────────────────────────────────────────

function updateButtons(): void {
  if (!combineBtn || !discardBtn) return;
  const nonEmptySelected = selectedIdxs.filter((i) => slots[i] !== null);
  combineBtn.disabled = nonEmptySelected.length !== 2;
  discardBtn.disabled = nonEmptySelected.length !== 1;
}

function render(): void {
  for (let i = 0; i < SLOTS; i++) {
    const el = bottleEls[i];
    if (!el) continue;
    const b = slots[i];
    if (b) {
      el.className = `vjolt-bottle ${b.colorClass}`;
      if (selectedIdxs.includes(i)) el.classList.add('selected');
      if (b.isPoison) el.classList.add('poison');
      const nameEl = el.querySelector('.vjolt-bottle-name') as HTMLElement;
      if (nameEl) nameEl.textContent = b.name;
      const valEl = el.querySelector('.vjolt-bottle-value') as HTMLElement;
      if (valEl) valEl.textContent = b.isPoison ? '' : `#${b.value}`;
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

  combineBtn = document.createElement('button');
  combineBtn.className = 'vjolt-btn vjolt-btn-combine';
  combineBtn.textContent = 'COMBINE';
  combineBtn.disabled = true;
  combineBtn.addEventListener('click', handleCombine);
  actions.appendChild(combineBtn);

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
    isPoison: false,
  };
  moves++;
  ctx?.playTone(0.3);
  render();
}

function handleBottleClick(idx: number): void {
  if (won || playingRef.value) return;
  if (idx >= slots.length || slots[idx] === null) return;

  const pos = selectedIdxs.indexOf(idx);
  if (pos >= 0) {
    selectedIdxs.splice(pos, 1);
  } else if (selectedIdxs.length < 2) {
    selectedIdxs.push(idx);
  }
  render();
}

function handleCombine(): void {
  if (won || playingRef.value || !config) return;
  if (selectedIdxs.length !== 2) return;
  const [a, b] = selectedIdxs;
  const bottleA = slots[a];
  const bottleB = slots[b];
  if (!bottleA || !bottleB) return;

  const anyPoison = bottleA.isPoison || bottleB.isPoison;
  const sameValue = bottleA.value === bottleB.value;
  const pair = pairKey(bottleA.value, bottleB.value);
  const isValid = !anyPoison && config.validPairs.includes(pair);

  selectedIdxs = [];

  // Same base value + not a valid equation pair → collapse into one
  if (sameValue && !isValid && !anyPoison) {
    slots[b] = null;
    moves++;
    ctx?.playTone(0.2);
    render();
    return;
  }

  slots[a] = null;
  slots[b] = null;

  if (isValid) {
    const newValue = bottleA.value + bottleB.value;
    const emptyIdx = slots.indexOf(null);
    slots[emptyIdx] = {
      id: nextId++,
      value: newValue,
      name: getNameForValue(newValue, config.target),
      colorClass: getColorClass(newValue, config.target),
      isPoison: false,
    };
    moves++;
    ctx?.playTone(0.5);

    if (newValue === config.target) {
      render();
      won = true;
      triggerWin();
      return;
    }
  } else {
    const emptyIdx = slots.indexOf(null);
    slots[emptyIdx] = {
      id: nextId++,
      value: 0,
      name: '☠ POISON',
      colorClass: 'vjolt-poison',
      isPoison: true,
    };
    moves++;
    ctx?.playTone(0.1);
  }

  render();
}

function handleDiscard(): void {
  if (won || playingRef.value) return;
  const idx = selectedIdxs.find((i) => slots[i] !== null);
  if (idx === undefined) return;

  slots[idx] = null;
  selectedIdxs = selectedIdxs.filter((i) => i !== idx);
  moves++;
  ctx?.playTone(0.15);
  render();
}

// ─── Win ─────────────────────────────────────────────────────────────

async function triggerWin(): Promise<void> {
  if (!ctx || !config) return;
  playingRef.value = true;
  ctx.setActions([]);

  const targetIdx = slots.findIndex((s) => s?.value === config!.target && !s.isPoison);
  if (targetIdx >= 0) {
    const el = bottleEls[targetIdx];
    if (el) el.classList.add('win');
  }

  await sleep(1000);
  ctx.playChime();
  await sleep(400);

  await completePuzzle(ctx, playingRef, async () => {}, newPuzzle, restartPuzzle, false);
}

// ─── Game lifecycle ──────────────────────────────────────────────────

function restartPuzzle(): void {
  slots = [null, null, null, null];
  nextId = 1;
  selectedIdxs = [];
  moves = 0;
  won = false;
  render();
}

function newPuzzle(): void {
  config = generatePuzzle();
  nameCache.clear();

  slots = [null, null, null, null];
  nextId = 1;
  selectedIdxs = [];
  moves = 0;
  won = false;
  bottleEls = [];
  combineBtn = null;
  discardBtn = null;

  container!.innerHTML = '';
  buildWall();
  buildShelf();
  buildWorkbench();
  buildActions();
  render();

  ctx?.setActions(makeActions(playingRef, newPuzzle, restartPuzzle));
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
    selectedIdxs = [];
    moves = 0;
    won = false;
    bottleEls = [];
    combineBtn = null;
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
        combineBtn = null;
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
export { generatePuzzle, optimalMoves, SLOTS, getNameForValue, getColorClass, pairKey };
export type { Bottle, PuzzleConfig, Equation, BaseChem };
