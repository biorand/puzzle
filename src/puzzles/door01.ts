import type { PuzzleContext, PuzzleModule } from '../types';

const MASKS = [0x00B, 0x017, 0x026, 0x059, 0x0BA, 0x134, 0x0C8, 0x1D0, 0x1A0];
const SOLVED = 0x1FF;

const dist = new Int8Array(512).fill(-1);
const groups: number[][] = Array.from({ length: 5 }, () => []);
let maxDist = 0;

{
  const q = [SOLVED];
  dist[SOLVED] = 0;
  groups[0].push(SOLVED);

  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    const nd = dist[cur] + 1;
    if (nd > maxDist) maxDist = nd;

    for (const mask of MASKS) {
      const next = cur ^ mask;
      if (dist[next] !== -1) continue;
      dist[next] = nd;
      q.push(next);
      if (nd < groups.length) groups[nd].push(next);
    }
  }
}

let state = SOLVED;
let initialState = SOLVED;
let moves = 0;
let optimal = 0;
let playing = false;
let cells: HTMLButtonElement[] = [];
let ctx: PuzzleContext | null = null;

function render(): void {
  for (let i = 0; i < 9; i++)
    cells[i].classList.toggle('orange', !!(state & (1 << i)));
  if (ctx) ctx.setStatus({ moves, optimal });
}

function generatePuzzle(): void {
  const maxD = Math.min(4, maxDist);
  const d = Math.floor(Math.random() * maxD) + 1;
  const pool = groups[d];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  initialState = pick;
  state = pick;
  moves = 0;
  optimal = d;
  render();
}

function press(idx: number): void {
  if (playing || !ctx) return;
  state ^= MASKS[idx];
  moves++;
  ctx.playTone(idx / 8);
  render();
  if (state === SOLVED) completeAnimation();
}

async function completeAnimation(): Promise<void> {
  if (!ctx) return;
  playing = true;
  ctx.playChime();
  ctx.setActions([]);

  for (let i = 8; i >= 0; i--) {
    await new Promise(r => setTimeout(r, 120));
    cells[i].classList.remove('orange');
  }

  await ctx.showOverlay();

  ctx.score.increment();
  generatePuzzle();
  ctx.setActions([
    {
      label: 'New Puzzle',
      handler: () => { if (!playing) generatePuzzle(); },
    },
    {
      label: 'Reset',
      handler: () => {
        if (!playing) {
          state = initialState;
          moves = 0;
          render();
        }
      },
    },
  ]);
  playing = false;
}

export const door01: PuzzleModule = {
  id: 'door01',
  slug: 'keypad',
  sourceGame: 're1',
  name: 'Keypad',

  create(container: HTMLElement, context: PuzzleContext) {
    ctx = context;

    const keypad = document.createElement('div');
    keypad.id = 'keypad';
    keypad.innerHTML = Array.from({ length: 9 }, (_, i) =>
      `<button class="cell" data-idx="${i}">${i + 1}</button>`
    ).join('');
    container.appendChild(keypad);

    cells = Array.from(keypad.querySelectorAll('.cell')) as HTMLButtonElement[];

    for (const cell of cells) {
      cell.addEventListener('click', () =>
        press(parseInt(cell.dataset.idx!, 10))
      );
    }

    generatePuzzle();

    ctx.setActions([
      {
        label: 'New Puzzle',
        handler: () => { if (!playing) generatePuzzle(); },
      },
      {
        label: 'Reset',
        handler: () => {
          if (!playing) {
            state = initialState;
            moves = 0;
            render();
          }
        },
      },
    ]);

    return {
      destroy(): void {
        cells = [];
        container.innerHTML = '';
        ctx = null;
      },
    };
  },
};
