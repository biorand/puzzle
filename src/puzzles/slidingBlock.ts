import type { PuzzleContext, PuzzleModule } from '../types';

const ROWS = 3;
const COLS = 3;
const SIZE = ROWS * COLS;

const UMBRELLA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50,50 L90,50 Q70.48,58.48 78.28,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,78.28 Q58.48,70.48 50,90 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,90 Q41.52,70.48 21.72,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,78.28 Q29.52,58.48 10,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L10,50 Q29.52,41.52 21.72,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,21.72 Q41.52,29.52 50,10 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,10 Q58.48,29.52 78.28,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,21.72 Q70.48,41.52 90,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
</svg>`;

const SVG_DATA_URI = `data:image/svg+xml,${encodeURIComponent(UMBRELLA_SVG)}`;

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const GOAL_STR = GOAL.join(',');

// ── Board helpers ──

function indexOf(board: number[], value: number): number {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === value) return i;
  }
  return -1;
}

// Shift all tiles between `clickPos` and `blank` toward `blank`
function applyShift(board: number[], blank: number, clickPos: number): number[] {
  const next = board.slice();
  const bRow = Math.floor(blank / COLS);
  const bCol = blank % COLS;
  const cRow = Math.floor(clickPos / COLS);
  const cCol = clickPos % COLS;

  if (bRow === cRow) {
    // Same row — shift horizontally
    if (cCol < bCol) {
      // Clicked left of blank — shift right
      for (let c = bCol; c > cCol; c--) next[bRow * COLS + c] = next[bRow * COLS + (c - 1)];
    } else {
      // Clicked right of blank — shift left
      for (let c = bCol; c < cCol; c++) next[bRow * COLS + c] = next[bRow * COLS + (c + 1)];
    }
    next[clickPos] = 0;
  } else if (bCol === cCol) {
    // Same column — shift vertically
    if (cRow < bRow) {
      // Clicked above blank — shift down
      for (let r = bRow; r > cRow; r--) next[r * COLS + bCol] = next[(r - 1) * COLS + bCol];
    } else {
      // Clicked below blank — shift up
      for (let r = bRow; r < cRow; r++) next[r * COLS + bCol] = next[(r + 1) * COLS + bCol];
    }
    next[clickPos] = 0;
  }
  return next;
}

function isSameRowOrCol(a: number, b: number): boolean {
  return Math.floor(a / COLS) === Math.floor(b / COLS) || a % COLS === b % COLS;
}

function* possibleMoves(board: number[], blank: number): Generator<number[]> {
  const bRow = Math.floor(blank / COLS);
  const bCol = blank % COLS;
  for (let c = 0; c < COLS; c++) {
    if (c === bCol) continue;
    yield applyShift(board, blank, bRow * COLS + c);
  }
  for (let r = 0; r < ROWS; r++) {
    if (r === bRow) continue;
    yield applyShift(board, blank, r * COLS + bCol);
  }
}

// ── BFS solver ──
// Uses string keys (board.join(',')) instead of bit-packing to avoid
// JS 32-bit signed integer overflow in bitwise operators.

function getOptimal(startBoard: number[]): number {
  const startStr = startBoard.join(',');
  if (startStr === GOAL_STR) return 0;

  const dist = new Map<string, number>();
  const q: Array<[number[], number, string]> = [[startBoard, indexOf(startBoard, 0), startStr]];
  dist.set(startStr, 0);

  let head = 0;
  while (head < q.length) {
    const [curBoard, blank, curStr] = q[head++];
    const d = dist.get(curStr)!;

    for (const nextBoard of possibleMoves(curBoard, blank)) {
      const nextStr = nextBoard.join(',');
      const nextBlank = indexOf(nextBoard, 0);

      if (!dist.has(nextStr)) {
        if (nextStr === GOAL_STR) return d + 1;
        dist.set(nextStr, d + 1);
        q.push([nextBoard, nextBlank, nextStr]);
      }
    }
  }
  return -1;
}

// ── Puzzle generation ──

function shufflePuzzle(): { board: number[]; optimal: number } {
  for (;;) {
    const board = [...GOAL];
    let blank = SIZE - 1;
    const steps = 500;
    for (let s = 0; s < steps; s++) {
      // Pick a random tile in the same row or column as blank and shift
      const moves = [...possibleMoves(board, blank)];
      const nextBoard = moves[Math.floor(Math.random() * moves.length)];
      for (let i = 0; i < SIZE; i++) board[i] = nextBoard[i];
      blank = indexOf(board, 0);
    }
    const optimal = getOptimal(board);
    if (optimal > 0) return { board, optimal };
  }
}

// ── State ──

let board: number[] = [];
let blankPos = 0;
let moves = 0;
let optimal = 0;
let playing = false;
let initialBoard: number[] = [];

let wrap: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let tileEls: HTMLElement[] = [];

// ── DOM build ──

function buildDOM(container: HTMLElement): void {
  wrap = document.createElement('div');
  wrap.id = 'sliding-wrap';
  container.appendChild(wrap);

  // Background grid lines
  const grid = document.createElement('div');
  grid.id = 'sliding-grid';
  wrap.appendChild(grid);

  // Tile elements — one per value (1..8), absolutely positioned
  tileEls = [];
  for (let v = 1; v < SIZE; v++) {
    const tile = document.createElement('div');
    tile.className = 'sliding-tile';
    tile.dataset.value = String(v);

    // Umbrella fragment as background
    tile.style.backgroundImage = `url(${SVG_DATA_URI})`;
    tile.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;

    // Fixed background position: each tile shows the fragment from its goal position
    const goalCol = (v - 1) % COLS;
    const goalRow = Math.floor((v - 1) / COLS);
    tile.style.backgroundPosition = `${(goalCol / (COLS - 1)) * 100}% ${(goalRow / (ROWS - 1)) * 100}%`;

    tile.addEventListener('click', () => pressTile(v));
    wrap.appendChild(tile);
    tileEls.push(tile);
  }
}

// ── Render ──

function render(): void {
  if (!wrap) return;
  const wrapW = wrap.clientWidth;
  const cellSize = wrapW / COLS;

  for (const tile of tileEls) {
    tile.style.display = 'none';
  }

  for (let i = 0; i < SIZE; i++) {
    const val = board[i];
    if (val === 0) continue;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const tile = tileEls[val - 1];
    tile.style.display = 'flex';
    tile.style.width = `${cellSize}px`;
    tile.style.height = `${cellSize}px`;
    tile.style.transform = `translate(${col * cellSize}px, ${row * cellSize}px)`;
  }

  if (ctx) ctx.setStatus({ moves, optimal });
}

function generatePuzzle(): void {
  const result = shufflePuzzle();
  board = result.board;
  optimal = result.optimal;
  blankPos = indexOf(board, 0);
  moves = 0;
  playing = false;
  initialBoard = [...board];
  render();
}

function resetPuzzle(): void {
  board = [...initialBoard];
  blankPos = indexOf(board, 0);
  moves = 0;
  playing = false;
  render();
}

// ── Interaction ──

function pressTile(value: number): void {
  if (playing || !ctx) return;

  const pos = indexOf(board, value);
  if (pos === -1) return;
  if (!isSameRowOrCol(blankPos, pos)) return;

  // Shift all tiles between clicked tile and blank toward blank
  board = applyShift(board, blankPos, pos);
  blankPos = pos;
  moves++;

  ctx.playTone(value / SIZE);
  render();

  // Check solved
  if (board.join(',') === GOAL_STR) {
    setTimeout(() => completeAnimation(), 200);
  }
}

// ── Completion ──

async function completeAnimation(): Promise<void> {
  if (!ctx) return;
  playing = true;
  ctx.setActions([]);

  // RE4-style item fanfare (runs in parallel with flash)
  const melody = ctx.playMelody('G4E5C5D5E5C5G4');

  // Flash the tiles
  for (let f = 0; f < 3; f++) {
    for (const el of tileEls) el.style.filter = f % 2 === 0 ? 'brightness(0.5)' : 'brightness(1)';
    await new Promise((r) => setTimeout(r, 180));
  }
  for (const el of tileEls) el.style.filter = '';

  await melody;

  const nextMod = ctx.score.increment();
  if (nextMod) {
    await ctx.showOverlay(nextMod);
    return;
  }

  await ctx.showOverlay();
  generatePuzzle();

  ctx.setActions([
    {
      label: 'New Puzzle',
      handler: () => {
        if (!playing) generatePuzzle();
      },
    },
    {
      label: 'Reset',
      handler: () => {
        if (!playing) resetPuzzle();
      },
    },
  ]);
  playing = false;
}

// ── Module ──

export const slidingBlock: PuzzleModule = {
  id: 'slidingBlock',
  slug: 'sliding-block',
  sourceGame: 're4',
  name: 'Sliding Block',

  create(container: HTMLElement, context: PuzzleContext) {
    ctx = context;
    container.innerHTML = '';
    buildDOM(container);
    generatePuzzle();

    context.setActions([
      {
        label: 'New Puzzle',
        handler: () => {
          if (!playing) generatePuzzle();
        },
      },
      {
        label: 'Reset',
        handler: () => {
          if (!playing) resetPuzzle();
        },
      },
    ]);

    const onResize = () => render();
    window.addEventListener('resize', onResize);

    return {
      destroy() {
        window.removeEventListener('resize', onResize);
        container.innerHTML = '';
        wrap = null;
        ctx = null;
        tileEls = [];
        playing = false;
      },
    };
  },
};
