import type { PuzzleContext, PuzzleModule } from '../types';
import { makeActions, sleep } from './shared';

type Action = 'red' | 'blue' | 'green';

interface Plant43State {
  fills: [number, number, number];
  slots: [number, number, number];
}

interface BfsEntry {
  state: Plant43State;
  moves: number;
  path: Action[];
}

interface PuzzleConfig {
  targetFill: number;
  optimalMoves: number;
  solution: Action[];
  startState: Plant43State;
}

const CAPACITIES: [number, number, number] = [7, 5, 3];
const START_SLOTS: [number, number, number] = [1, 0, 2];
const START_FILLS: [number, number, number] = [7, 0, 0];
const MAX_MOVES = 20;
const MAX_TUBE_HEIGHT = 160;
const GLASS_BOTTOM_Y = 26;
const POUR_DURATION = 525;
const DRAIN_DURATION = 2400;

const TUBE_HEIGHTS = CAPACITIES.map((c) => Math.round((c / CAPACITIES[0]) * MAX_TUBE_HEIGHT));
const SLOT_LEFT = [0, 33.33, 66.67];

function cloneState(s: Plant43State): Plant43State {
  return {
    fills: [...s.fills] as [number, number, number],
    slots: [...s.slots] as [number, number, number],
  };
}

function stateKey(s: Plant43State): string {
  return `${s.slots[0]},${s.slots[1]},${s.slots[2]}|${s.fills[0]},${s.fills[1]},${s.fills[2]}`;
}

function apply(state: Plant43State, action: Action): Plant43State | null {
  const next = cloneState(state);
  switch (action) {
    case 'red':
      [next.slots[0], next.slots[1]] = [next.slots[1], next.slots[0]];
      break;
    case 'blue':
      [next.slots[1], next.slots[2]] = [next.slots[2], next.slots[1]];
      break;
    case 'green': {
      const leftTube = next.slots[0];
      const midTube = next.slots[1];
      const pourAmt = Math.min(
        next.fills[midTube],
        Math.max(0, CAPACITIES[leftTube] - next.fills[leftTube]),
      );
      if (pourAmt === 0) return null;
      next.fills[leftTube] += pourAmt;
      next.fills[midTube] -= pourAmt;
      break;
    }
  }
  return next;
}

function isWin(state: Plant43State, targetFill: number): boolean {
  return state.fills[state.slots[0]] === targetFill;
}

function bfsAll(start?: Plant43State): Map<string, BfsEntry> {
  const s = start || { fills: [...START_FILLS], slots: [...START_SLOTS] };
  const visited = new Map<string, BfsEntry>();
  const queue: BfsEntry[] = [];

  const k = stateKey(s);
  visited.set(k, { state: s, moves: 0, path: [] });
  queue.push({ state: s, moves: 0, path: [] });

  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (entry.moves >= MAX_MOVES) continue;

    for (const action of ['red', 'blue', 'green'] as Action[]) {
      const next = apply(entry.state, action);
      if (!next) continue;
      const nk = stateKey(next);
      if (!visited.has(nk)) {
        const newPath = [...entry.path, action];
        visited.set(nk, { state: next, moves: entry.moves + 1, path: newPath });
        queue.push({ state: next, moves: entry.moves + 1, path: newPath });
      }
    }
  }

  return visited;
}

function generateRandomStart(total: number): Plant43State {
  for (;;) {
    const a = Math.floor(Math.random() * (Math.min(total, CAPACITIES[0]) + 1));
    const rem = total - a;
    if (rem > CAPACITIES[1] + CAPACITIES[2]) continue;
    const b = Math.floor(Math.random() * (Math.min(rem, CAPACITIES[1]) + 1));
    const c = rem - b;
    if (c >= 0 && c <= CAPACITIES[2]) {
      return { fills: [a, b, c], slots: [...START_SLOTS] };
    }
  }
}

const ALL_REACHABLE = bfsAll();

function generatePuzzle(): PuzzleConfig {
  for (let attempt = 0; attempt < 200; attempt++) {
    const total = 4 + Math.floor(Math.random() * 9);
    const startState = generateRandomStart(total);
    const reachable = bfsAll(startState);

    // For each valid fill value, track the shortest path to reach it
    const bestPerFill = new Map<number, BfsEntry>();
    for (const entry of reachable.values()) {
      const f = entry.state.fills[entry.state.slots[0]];
      if (f <= 0 || f >= 7 || CAPACITIES.includes(f)) continue;
      const best = bestPerFill.get(f);
      if (!best || entry.moves < best.moves) {
        bestPerFill.set(f, entry);
      }
    }

    const validFills = Array.from(bestPerFill.entries()).filter(
      ([, v]) => v.moves >= 4 && v.moves <= MAX_MOVES,
    );

    if (validFills.length > 0) {
      const chosen = validFills[Math.floor(Math.random() * validFills.length)];
      return {
        targetFill: chosen[0],
        optimalMoves: chosen[1].moves,
        solution: chosen[1].path,
        startState,
      };
    }
  }

  // Fallback: use default start [1,0,2] / [7,0,0]
  const fallback = bfsAll();
  const bestPerFill = new Map<number, BfsEntry>();
  for (const entry of fallback.values()) {
    const f = entry.state.fills[entry.state.slots[0]];
    if (f <= 0 || f >= 7 || CAPACITIES.includes(f)) continue;
    const best = bestPerFill.get(f);
    if (!best || entry.moves < best.moves) {
      bestPerFill.set(f, entry);
    }
  }
  const validFills = Array.from(bestPerFill.entries()).filter(
    ([, v]) => v.moves >= 4 && v.moves <= MAX_MOVES,
  );
  const chosen = validFills[0];
  return {
    targetFill: chosen[0],
    optimalMoves: chosen[1].moves,
    solution: chosen[1].path,
    startState: { fills: [...START_FILLS], slots: [...START_SLOTS] },
  };
}

// ─── Module State ────────────────────────────────────────────────────

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let currentState: Plant43State | null = null;
let puzzleConfig: PuzzleConfig | null = null;
let moves = 0;
let won = false;
let animating = false;
const playingRef = { value: false };

let tubeEls: HTMLDivElement[] = [];
let fillBars: HTMLDivElement[] = [];
let targetLine: HTMLDivElement | null = null;

// ─── Rendering ───────────────────────────────────────────────────────

function render(): void {
  if (!currentState || !puzzleConfig) return;

  const { slots, fills } = currentState;

  for (let tubeId = 0; tubeId < 3; tubeId++) {
    const slotIdx = slots.indexOf(tubeId);
    const fill = fills[tubeId];
    const cap = CAPACITIES[tubeId];
    const glassH = TUBE_HEIGHTS[tubeId];
    const fillArea = glassH - 4;
    const pct = (((fill / cap) * fillArea) / glassH) * 100;

    const tube = tubeEls[tubeId];
    if (!tube) continue;

    tube.style.left = `${SLOT_LEFT[slotIdx]}%`;

    const bar = fillBars[tubeId];
    if (bar) bar.style.height = `${pct}%`;

    tube.dataset.slot = String(slotIdx);
  }

  if (targetLine && currentState) {
    const leftTube = currentState.slots[0];
    const leftCap = CAPACITIES[leftTube];
    const leftGlassH = TUBE_HEIGHTS[leftTube];
    const lineBottom = GLASS_BOTTOM_Y + (puzzleConfig.targetFill / leftCap) * leftGlassH;
    targetLine.style.bottom = `${lineBottom}px`;
  }

  if (ctx) ctx.setStatus({ moves, optimal: puzzleConfig.optimalMoves });
}

function buildStage(): void {
  if (!container) return;

  const stage = document.createElement('div');
  stage.className = 'plant43-stage';

  targetLine = document.createElement('div');
  targetLine.className = 'plant43-target-line';
  stage.appendChild(targetLine);

  tubeEls = [];
  fillBars = [];

  for (let tubeId = 0; tubeId < 3; tubeId++) {
    const tube = document.createElement('div');
    tube.className = 'plant43-tube';

    const glass = document.createElement('div');
    glass.className = 'plant43-tube-glass';
    glass.style.height = `${TUBE_HEIGHTS[tubeId]}px`;
    tube.appendChild(glass);

    const fill = document.createElement('div');
    fill.className = 'plant43-tube-fill';
    glass.appendChild(fill);
    fillBars.push(fill);

    const markers = document.createElement('div');
    markers.className = 'plant43-tube-markers';
    for (let i = 1; i < CAPACITIES[tubeId]; i++) {
      const m = document.createElement('div');
      m.className = 'plant43-tube-marker';
      m.style.bottom = `${(i / CAPACITIES[tubeId]) * 100}%`;

      const line = document.createElement('div');
      line.className = 'plant43-tube-marker-line';
      m.appendChild(line);

      const lbl = document.createElement('span');
      lbl.className = 'plant43-tube-marker-label';
      lbl.textContent = String(i);
      m.appendChild(lbl);

      markers.appendChild(m);
    }
    glass.appendChild(markers);

    stage.appendChild(tube);
    tubeEls.push(tube);
  }

  container.appendChild(stage);
}

const ICONS: Record<string, string> = {
  green: 'arrow_downward',
  red: 'swap_horiz',
  blue: 'sync_alt',
};

function buildButtons(): void {
  if (!container) return;

  const btnWrap = document.createElement('div');
  btnWrap.className = 'plant43-buttons';

  const order: Action[] = ['green', 'red', 'blue'];

  for (const action of order) {
    const btn = document.createElement('button');
    btn.className = `plant43-btn btn-${action}`;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = ICONS[action];
    btn.appendChild(icon);

    btn.addEventListener('click', () => handleAction(action));
    btnWrap.appendChild(btn);
  }

  container.appendChild(btnWrap);
}

// ─── Actions ─────────────────────────────────────────────────────────

function handleAction(action: Action): void {
  if (won || animating || !currentState || !puzzleConfig || !ctx) return;

  const next = apply(currentState, action);
  if (!next) return;

  animating = true;
  currentState = next;
  moves++;
  render();

  if (action === 'red' || action === 'blue') {
    const swapDur = 370;
    ctx.playTone(0.35);
    if (isWin(currentState, puzzleConfig.targetFill)) {
      setTimeout(() => {
        won = true;
        drainAnimation();
        animating = false;
      }, swapDur);
    } else {
      setTimeout(() => {
        animating = false;
      }, swapDur);
    }
  } else {
    ctx.playTone(0.5);
    if (isWin(currentState, puzzleConfig.targetFill)) {
      setTimeout(() => {
        won = true;
        drainAnimation();
        animating = false;
      }, POUR_DURATION + 50);
    } else {
      setTimeout(() => {
        animating = false;
      }, POUR_DURATION + 50);
    }
  }
}

async function drainAnimation(): Promise<void> {
  if (!ctx || !puzzleConfig || !currentState) return;

  ctx.setActions([]);

  const leftTube = currentState.slots[0];
  const bar = fillBars[leftTube];
  if (bar) {
    bar.style.transition = `height ${DRAIN_DURATION}ms ease-in`;
    bar.style.height = '0%';
  }

  const drainTones = [0.5, 0.42, 0.35, 0.28, 0.2];
  const toneInterval = DRAIN_DURATION / drainTones.length;
  for (let ti = 0; ti < drainTones.length; ti++) {
    setTimeout(() => ctx!.playTone(drainTones[ti]), ti * toneInterval);
  }

  await sleep(DRAIN_DURATION + 200);

  ctx.playChime();

  const nextMod = ctx.score.increment();
  if (nextMod) {
    await ctx.showOverlay(nextMod);
  } else {
    await ctx.showOverlay();
  }

  newPuzzle();
  ctx.setActions(makeActions(playingRef, newPuzzle, restartPuzzle));
}

function restartPuzzle(): void {
  if (!puzzleConfig) return;
  currentState = {
    fills: [...puzzleConfig.startState.fills],
    slots: [...puzzleConfig.startState.slots],
  };
  moves = 0;
  won = false;
  animating = false;

  for (const bar of fillBars) bar.style.transition = `height ${POUR_DURATION}ms ease`;

  render();
}

function newPuzzle(): void {
  puzzleConfig = generatePuzzle();
  restartPuzzle();
}

// ─── Thumbnail ───────────────────────────────────────────────────────

const THUMBNAIL = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="10" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="18" y="20" width="4" height="80" rx="1" fill="#0a0"/>
  <rect x="50" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="58" y="60" width="4" height="40" rx="1" fill="#0a0"/>
  <rect x="90" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="98" y="80" width="4" height="20" rx="1" fill="#0a0"/>
  <line x1="18" y1="40" x2="38" y2="40" stroke="#f00" stroke-width="2.5"/>
  <circle cx="16" cy="18" r="6" fill="#c00"/>
  <circle cx="56" cy="18" r="6" fill="#00c"/>
  <circle cx="96" cy="18" r="6" fill="#0a0"/>
</svg>`;

// ─── Module Export ───────────────────────────────────────────────────

export const plant43: PuzzleModule = {
  id: 'plant43',
  slug: 'plant-43',
  sourceGame: 're2r',
  name: 'Plant 43',
  thumbnail: THUMBNAIL,

  create(c: HTMLElement, context: PuzzleContext) {
    container = c;
    ctx = context;

    puzzleConfig = generatePuzzle();
    currentState = {
      fills: [...puzzleConfig.startState.fills],
      slots: [...puzzleConfig.startState.slots],
    };
    moves = 0;
    won = false;
    animating = false;

    buildStage();
    buildButtons();
    render();

    ctx.setActions(makeActions(playingRef, newPuzzle, restartPuzzle));

    return {
      destroy(): void {
        tubeEls = [];
        fillBars = [];
        targetLine = null;
        container!.innerHTML = '';
        container = null;
        ctx = null;
        currentState = null;
        puzzleConfig = null;
        won = false;
        animating = false;
      },
    };
  },
};

export {
  apply,
  bfsAll,
  CAPACITIES,
  START_FILLS,
  START_SLOTS,
  isWin,
  generatePuzzle,
  generateRandomStart,
  ALL_REACHABLE,
};
export type { Action, Plant43State, PuzzleConfig };
