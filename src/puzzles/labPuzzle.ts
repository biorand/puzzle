import type { PuzzleContext, PuzzleModule } from '../types';
import { completePuzzle, makeActions, sleep } from './shared';

type Direction = 'up' | 'right' | 'down' | 'left';
type Color = 'red' | 'blue' | 'yellow' | 'green';

interface Cell {
  direction: Direction;
  colorIndex: number;
}

const COLORS: Color[] = ['red', 'blue', 'yellow', 'green'];
const DIR_ORDER: Direction[] = ['up', 'right', 'down', 'left'];
const DIR_INDEX: Record<Direction, number> = { up: 0, right: 1, down: 2, left: 3 };
const ARROW_CHARS: Record<Direction, string> = {
  up: '\u2191',
  right: '\u2192',
  down: '\u2193',
  left: '\u2190',
};

const DR: Record<Direction, [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

function rotate(dir: Direction, times: number): Direction {
  return DIR_ORDER[(DIR_INDEX[dir] + times) % 4];
}

function tracePower(grid: Cell[], presses: number[]): Set<number> {
  const visited = new Set<number>();
  let idx = 0;
  while (idx >= 0 && idx < 9 && !visited.has(idx)) {
    visited.add(idx);
    const cell = grid[idx];
    const dir = rotate(cell.direction, presses[cell.colorIndex]);
    const [dr, dc] = DR[dir];
    const r = Math.floor(idx / 3) + dr;
    const c = (idx % 3) + dc;
    if (r < 0 || r > 2 || c < 0 || c > 2) break;
    idx = r * 3 + c;
  }
  return visited;
}

function isSolved(powered: Set<number>): boolean {
  return powered.has(8);
}

function solve(grid: Cell[]): number[] | null {
  let best: number[] | null = null;
  let bestTotal = Infinity;
  for (let r = 0; r < 4; r++) {
    for (let b = 0; b < 4; b++) {
      for (let y = 0; y < 4; y++) {
        for (let g = 0; g < 4; g++) {
          const presses = [r, b, y, g];
          const total = r + b + y + g;
          if (total >= bestTotal) continue;
          if (isSolved(tracePower(grid, presses))) {
            bestTotal = total;
            best = presses;
          }
        }
      }
    }
  }
  return best;
}

let grid: Cell[] = [];
let initialGrid: Cell[] = [];
let colorPresses: number[] = [0, 0, 0, 0];
let moves = 0;
let optimal = 0;
const playingRef = { value: false };
let flashTimeouts: (number | null)[] = [];

let wrap: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let cellEls: HTMLElement[] = [];
let arrowEls: HTMLElement[] = [];
let flowEls: HTMLElement[] = [];
let flowArrowEls: HTMLElement[][] = [];
let btnEls: HTMLElement[] = [];

function buildDOM(container: HTMLElement): void {
  wrap = document.createElement('div');
  wrap.id = 'lab-wrap';
  container.appendChild(wrap);

  const headerNote = document.createElement('div');
  headerNote.id = 'lab-note';
  headerNote.textContent = 'START \u2192 GOAL';
  wrap.appendChild(headerNote);

  const gridEl = document.createElement('div');
  gridEl.id = 'lab-grid';
  wrap.appendChild(gridEl);

  cellEls = [];
  arrowEls = [];
  flowEls = [];
  flowArrowEls = [];
  flashTimeouts = new Array(9).fill(null);

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'lab-cell';
    cell.dataset.index = String(i);
    gridEl.appendChild(cell);
    cellEls.push(cell);

    const arrow = document.createElement('div');
    arrow.className = 'lab-arrow';
    cell.appendChild(arrow);
    arrowEls.push(arrow);

    const flow = document.createElement('div');
    flow.className = 'lab-flow';
    cell.appendChild(flow);
    flowEls.push(flow);

    const fas: HTMLElement[] = [];
    for (let f = 0; f < 3; f++) {
      const fa = document.createElement('span');
      fa.className = 'lab-flow-arrow';
      flow.appendChild(fa);
      fas.push(fa);
    }
    flowArrowEls.push(fas);
  }

  const btnWrap = document.createElement('div');
  btnWrap.id = 'lab-buttons';
  wrap.appendChild(btnWrap);

  const COLOR_LABELS = ['R', 'B', 'Y', 'G'];
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.className = `lab-btn lab-btn-${COLORS[i]}`;
    btn.dataset.colorIndex = String(i);
    btn.setAttribute('aria-label', `${COLORS[i]} button`);
    btn.textContent = COLOR_LABELS[i];
    btn.addEventListener('click', () => pressColor(i));
    btnWrap.appendChild(btn);
    btnEls.push(btn);
  }
}

function renderPower(powered: Set<number>): void {
  for (let i = 0; i < 9; i++) {
    const cell = grid[i];
    const effectiveDir = rotate(cell.direction, colorPresses[cell.colorIndex]);
    const colorName = COLORS[cell.colorIndex];
    const isPow = powered.has(i);

    let cls = `lab-cell lab-${colorName}`;
    if (isPow) cls += ' lab-powered';
    if (i === 0) cls += ' lab-start';
    if (i === 8) cls += ' lab-goal';
    cellEls[i].className = cls;

    arrowEls[i].textContent = ARROW_CHARS[effectiveDir];

    let flowCls = 'lab-flow';
    if (isPow) {
      flowCls += ` lab-flow-active lab-flow-${effectiveDir}`;
    }
    flowEls[i].className = flowCls;

    const ch = ARROW_CHARS[effectiveDir];
    for (const fa of flowArrowEls[i]) {
      fa.textContent = ch;
    }
  }
}

function render(): void {
  if (!wrap) return;
  const powered = tracePower(grid, colorPresses);
  renderPower(powered);
  if (ctx) ctx.setStatus({ moves, optimal });
}

function flashColorCells(colorIdx: number): void {
  for (let i = 0; i < 9; i++) {
    if (grid[i].colorIndex === colorIdx) {
      if (flashTimeouts[i] !== null) clearTimeout(flashTimeouts[i]!);
      cellEls[i].classList.add('lab-flash');
      flashTimeouts[i] = window.setTimeout(() => {
        cellEls[i].classList.remove('lab-flash');
        flashTimeouts[i] = null;
      }, 500);
    }
  }
}

function clearAllFlashes(): void {
  for (let i = 0; i < 9; i++) {
    if (flashTimeouts[i] !== null) {
      clearTimeout(flashTimeouts[i]!);
      flashTimeouts[i] = null;
    }
    cellEls[i]?.classList.remove('lab-flash');
  }
}

function generatePuzzle(): void {
  let solution: number[] | null = null;
  let attempts = 0;
  do {
    grid = [];
    for (let i = 0; i < 9; i++) {
      let dir = DIR_ORDER[Math.floor(Math.random() * 4)];
      if (i === 0 && dir === 'down') dir = 'up';
      grid.push({
        direction: dir,
        colorIndex: Math.floor(Math.random() * 4),
      });
    }
    solution = solve(grid);
    attempts++;
    if (attempts > 10000) break;
  } while (!solution);

  if (!solution) {
    grid = [];
    for (let i = 0; i < 9; i++) {
      grid.push({ direction: 'right', colorIndex: i % 4 });
    }
    solution = solve(grid);
  }

  initialGrid = grid.map((c) => ({ ...c }));
  colorPresses = [0, 0, 0, 0];
  moves = 0;
  optimal = solution ? solution.reduce((a, b) => a + b, 0) : 0;
  playingRef.value = false;
  clearAllFlashes();
  render();
}

function resetPuzzle(): void {
  grid = initialGrid.map((c) => ({ ...c }));
  colorPresses = [0, 0, 0, 0];
  moves = 0;
  playingRef.value = false;
  clearAllFlashes();
  render();
}

function pressColor(colorIdx: number): void {
  if (playingRef.value || !ctx) return;

  colorPresses[colorIdx] = (colorPresses[colorIdx] + 1) % 4;
  moves++;

  ctx.playTone(colorIdx / 4);
  render();
  flashColorCells(colorIdx);

  const powered = tracePower(grid, colorPresses);
  if (isSolved(powered)) {
    setTimeout(() => completeAnimation(), 300);
  }
}

async function completeAnimation(): Promise<void> {
  await completePuzzle(
    ctx,
    playingRef,
    async () => {
      const melody = ctx!.playMelody('E4G4A4C5E5D5C5G4');

      for (let f = 0; f < 4; f++) {
        for (const el of cellEls) {
          el.style.filter = f % 2 === 0 ? 'brightness(1.5)' : 'brightness(1)';
        }
        await sleep(150);
      }
      for (const el of cellEls) el.style.filter = '';

      await melody;
    },
    generatePuzzle,
    resetPuzzle,
    false,
  );
}

const LAB_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="6" y="6" width="34" height="34" rx="4" fill="#3a1111" stroke="#ff4444" stroke-width="2"/>
  <text x="23" y="29" text-anchor="middle" fill="#ff6666" font-size="18" font-weight="bold">\u2192</text>
  <rect x="43" y="6" width="34" height="34" rx="4" fill="#111a3a" stroke="#4488ff" stroke-width="2"/>
  <text x="60" y="29" text-anchor="middle" fill="#66aaff" font-size="18" font-weight="bold">\u2193</text>
  <rect x="80" y="6" width="34" height="34" rx="4" fill="#3a3a11" stroke="#ffcc00" stroke-width="2"/>
  <text x="97" y="29" text-anchor="middle" fill="#ffdd44" font-size="18" font-weight="bold">\u2190</text>
  <rect x="6" y="43" width="34" height="34" rx="4" fill="#113a11" stroke="#44cc44" stroke-width="2"/>
  <text x="23" y="66" text-anchor="middle" fill="#66ee66" font-size="18" font-weight="bold">\u2191</text>
  <rect x="43" y="43" width="34" height="34" rx="4" fill="#3a1111" stroke="#ff4444" stroke-width="2"/>
  <text x="60" y="66" text-anchor="middle" fill="#ff6666" font-size="18" font-weight="bold">\u2192</text>
  <rect x="80" y="43" width="34" height="34" rx="4" fill="#111a3a" stroke="#4488ff" stroke-width="2"/>
  <text x="97" y="66" text-anchor="middle" fill="#66aaff" font-size="18" font-weight="bold">\u2193</text>
  <rect x="6" y="80" width="34" height="34" rx="4" fill="#3a3a11" stroke="#ffcc00" stroke-width="2"/>
  <text x="23" y="103" text-anchor="middle" fill="#ffdd44" font-size="18" font-weight="bold">\u2190</text>
  <rect x="43" y="80" width="34" height="34" rx="4" fill="#113a11" stroke="#44cc44" stroke-width="2"/>
  <text x="60" y="103" text-anchor="middle" fill="#66ee66" font-size="18" font-weight="bold">\u2191</text>
  <rect x="80" y="80" width="34" height="34" rx="4" fill="#3a1111" stroke="#ff8800" stroke-width="2"/>
  <text x="97" y="103" text-anchor="middle" fill="#ff8800" font-size="18" font-weight="bold">\u25C9</text>
</svg>`;

export const labPuzzle: PuzzleModule = {
  id: 'labPuzzle',
  slug: 'lab-puzzle',
  sourceGame: 're4',
  name: 'Lab Puzzle',
  thumbnail: LAB_THUMB,

  create(container: HTMLElement, context: PuzzleContext) {
    ctx = context;
    container.innerHTML = '';
    buildDOM(container);
    generatePuzzle();
    context.setActions(makeActions(playingRef, generatePuzzle, resetPuzzle));

    const onResize = () => render();
    window.addEventListener('resize', onResize);

    return {
      destroy() {
        window.removeEventListener('resize', onResize);
        clearAllFlashes();
        container.innerHTML = '';
        wrap = null;
        ctx = null;
        cellEls = [];
        arrowEls = [];
        flowEls = [];
        flowArrowEls = [];
        btnEls = [];
        flashTimeouts = [];
        playingRef.value = false;
      },
    };
  },
};
