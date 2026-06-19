import type { PuzzleContext, PuzzleModule } from '../types';

const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
const SOLVED = 0x1ff;

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
let cheatBuffer: number[] = [];
let cheatCount = 0;
let tutorialDiv: HTMLDivElement | null = null;

function render(): void {
  for (let i = 0; i < 9; i++) cells[i].classList.toggle('orange', !!(state & (1 << i)));
  if (ctx) ctx.setStatus({ moves, optimal });
}

function generatePuzzle(): void {
  let d: number;
  if (
    ctx &&
    ctx.forceDifficulty !== undefined &&
    ctx.forceDifficulty >= 1 &&
    ctx.forceDifficulty <= maxDist
  ) {
    d = ctx.forceDifficulty;
  } else {
    const maxD = Math.min(4, maxDist);
    d = Math.floor(Math.random() * maxD) + 1;
  }
  const pool = groups[d];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  initialState = pick;
  state = pick;
  moves = 0;
  optimal = d;
  cheatBuffer = [];
  // Update tutorial display
  if (tutorialDiv) {
    if (ctx && ctx.tutorialStep !== undefined) {
      const stepNum = ctx.tutorialStep + 1;
      const totalNum = ctx.tutorialTotal ?? 5;
      const movesRequired = d;
      tutorialDiv.textContent = `Tutorial ${stepNum}/${totalNum} — Solve in ${movesRequired} move${movesRequired !== 1 ? 's' : ''}`;
      tutorialDiv.style.display = '';
    } else {
      tutorialDiv.style.display = 'none';
    }
  }
  render();
}

function press(idx: number): void {
  if (playing || !ctx) return;

  // Check if this press completes a cheat code (before playing the normal tone)
  const checkBuffer = [...cheatBuffer, idx + 1].slice(-4);
  const isCheatMatch =
    checkBuffer.length === 4 &&
    checkBuffer[0] === 2 &&
    checkBuffer[1] === 2 &&
    checkBuffer[2] === 3 &&
    checkBuffer[3] === 6;

  state ^= MASKS[idx];
  moves++;

  // Skip normal tone when cheat matches so melody notes are clearly audible
  if (!isCheatMatch) ctx.playTone(idx / 8);

  render();
  if (state === SOLVED) completeAnimation();

  // Cheat code: track "2236" rolling buffer
  cheatBuffer.push(idx + 1);
  if (cheatBuffer.length > 4) cheatBuffer.shift();

  if (isCheatMatch) {
    cheatCount++;
    if (cheatCount === 1) {
      ctx!.playMelody('D5');
    } else if (cheatCount === 2) {
      ctx!.playMelody('E5');
    } else if (cheatCount >= 3) {
      cheatCount = 3;
      const melody = ctx!.playMelody(
        `
        D5/3.0[0.3]
        Z/0.8 E5/3.0[0.2.5]
        Z/1.6 F5/5.0[0.2]
        `,
      );
      ctx!.onCheatUnlockAll?.(() => melody);
    }
  }
}

async function completeAnimation(): Promise<void> {
  if (!ctx) return;
  playing = true;
  ctx.playChime();
  ctx.setActions([]);

  for (let i = 8; i >= 0; i--) {
    await new Promise((r) => setTimeout(r, 120));
    cells[i].classList.remove('orange');
  }

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

export const keypad: PuzzleModule = {
  id: 'keypad',
  slug: 'keypad',
  sourceGame: 're1',
  name: 'Keypad',

  create(container: HTMLElement, context: PuzzleContext) {
    ctx = context;

    const keypad = document.createElement('div');
    keypad.id = 'keypad';
    keypad.innerHTML = Array.from(
      { length: 9 },
      (_, i) => `<button class="cell" data-idx="${i}">${i + 1}</button>`,
    ).join('');
    container.appendChild(keypad);

    cells = Array.from(keypad.querySelectorAll('.cell')) as HTMLButtonElement[];

    for (const cell of cells) {
      cell.addEventListener('click', () => press(parseInt(cell.dataset.idx!, 10)));
    }

    generatePuzzle();

    // Tutorial progress indicator
    if (context.tutorialStep !== undefined) {
      tutorialDiv = document.createElement('div');
      tutorialDiv.id = 'keypad-tutorial';
      const stepNum = context.tutorialStep + 1;
      const totalNum = context.tutorialTotal ?? 5;
      const movesRequired = context.forceDifficulty ?? 0;
      tutorialDiv.textContent = `Tutorial ${stepNum}/${totalNum} — Solve in ${movesRequired} move${movesRequired !== 1 ? 's' : ''}`;
      container.appendChild(tutorialDiv);
    }

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
        cheatBuffer = [];
        cheatCount = 0;
        tutorialDiv = null;
        playing = false;
      },
    };
  },
};
