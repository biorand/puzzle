import type { PuzzleModule, PuzzleContext } from '../types';

const UMBRELLA_SVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M50,50 L90,50 Q70.48,58.48 78.28,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,78.28 Q58.48,70.48 50,90 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,90 Q41.52,70.48 21.72,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,78.28 Q29.52,58.48 10,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L10,50 Q29.52,41.52 21.72,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,21.72 Q41.52,29.52 50,10 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,10 Q58.48,29.52 78.28,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,21.72 Q70.48,41.52 90,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
</svg>`;

const SIZES = [2, 3, 4, 5] as const;

let gridSize = 4;
let numBtns = 0;
let chain = 0;
let startIdx = -1;
let moves = 0;
let playing = false;
let wrongFlash: number | null = null;
let mapping: number[] = [];

let container: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;
let ringLights: HTMLDivElement[] = [];
let ringArrows: HTMLDivElement[] = [];
let gridBtns: HTMLButtonElement[] = [];
let diffBtns: HTMLButtonElement[] = [];
let rightPane: HTMLElement | null = null;

function render(): void {
  const inChain = (i: number): boolean => {
    if (chain === 0) return false;
    const end = startIdx + chain;
    if (end <= numBtns)
      return mapping[i] >= startIdx && mapping[i] < end;
    return mapping[i] >= startIdx || mapping[i] < end - numBtns;
  };
  for (let j = 0; j < numBtns; j++)
    ringLights[j].classList.remove('chain');
  for (let i = 0; i < numBtns; i++) {
    const ic = inChain(i);
    if (ic || i === wrongFlash)
      ringLights[mapping[i]].classList.add('chain');
    gridBtns[i].classList.toggle('pressed', ic);
    gridBtns[i].disabled = ic;
  }
  if (ctx) ctx.setStatus({ moves, optimal: numBtns });
}

function shuffle(a: number[]): number[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePuzzle(): void {
  mapping = shuffle(Array.from({ length: numBtns }, (_, i) => i));
  chain = 0;
  startIdx = -1;
  moves = 0;
  wrongFlash = null;
  render();
}

function press(idx: number): void {
  if (playing || !ctx) return;
  wrongFlash = null;

  const lightIdx = mapping[idx];

  if (chain === 0) {
    startIdx = lightIdx;
    chain = 1;
    moves++;
    ctx.playTone(chain / numBtns);
    render();
  } else {
    const expected = (startIdx + chain) % numBtns;
    if (lightIdx === expected) {
      chain++;
      moves++;
      ctx.playTone(chain / numBtns);
      render();
      if (chain === numBtns) completeAnimation();
    } else {
      wrongFlash = idx;
      chain = 0;
      startIdx = -1;
      moves++;
      ctx.playTone(0);
      render();
    }
  }
}

function resetPuzzle(): void {
  if (playing) return;
  chain = 0;
  startIdx = -1;
  moves = 0;
  wrongFlash = null;
  render();
}

async function completeAnimation(): Promise<void> {
  if (!ctx) return;
  playing = true;
  ctx.playChime();
  ctx.setActions([]);

  for (let i = 0; i < numBtns; i++)
    ringLights[i].classList.toggle('chain', i % 2 === 0);

  const melody = ctx.playMelody('E4B4G4.E4B4G4.E4B4G4F4E4D4');

  const interval = setInterval(() => {
    for (let i = 0; i < numBtns; i++)
      ringLights[i].classList.toggle('chain');
  }, 500);

  await melody;
  clearInterval(interval);

  for (let i = 0; i < numBtns; i++) {
    ringLights[i].classList.remove('chain');
    await new Promise(r => setTimeout(r, 100));
  }

  await ctx.showOverlay('UNLOCKED', 3000);

  ctx.score.increment();
  generatePuzzle();
  ctx.setActions([
    { label: 'New Puzzle', handler: () => { if (!playing) generatePuzzle(); } },
    { label: 'Reset', handler: resetPuzzle },
  ]);
  playing = false;
}

function setGridSize(n: number): void {
  if (playing || !container) return;
  gridSize = n;
  numBtns = gridSize * 2;
  for (const b of diffBtns) b.classList.toggle('active', parseInt(b.dataset.size!, 10) === n);
  buildRing();
  buildGrid();
  generatePuzzle();
}

function buildRing(): void {
  const existing = rightPane!.querySelector('#safe-ring-wrap');
  if (existing) existing.remove();
  ringLights = [];
  ringArrows = [];

  const wrap = document.createElement('div');
  wrap.id = 'safe-ring-wrap';

  const cx = 110, cy = 110, rLight = 82, rArrow = 76;
  const N = numBtns;

  for (let i = 0; i < N; i++) {
    const lightAngle = (360 / N) * (i + 0.5);
    const la = lightAngle * Math.PI / 180;
    const lx = cx + rLight * Math.cos(la);
    const ly = cy - rLight * Math.sin(la);

    const light = document.createElement('div');
    light.className = 'safe-light';
    light.style.left = `${lx}px`;
    light.style.top = `${ly}px`;
    wrap.appendChild(light);
    ringLights.push(light);

    const arrowAngle = (360 / N) * (i + 1);
    const aa = arrowAngle * Math.PI / 180;
    const ax = cx + rArrow * Math.cos(aa);
    const ay = cy - rArrow * Math.sin(aa);

    const arrow = document.createElement('div');
    arrow.className = 'safe-arrow';
    arrow.textContent = '⏏';
    arrow.style.left = `${ax}px`;
    arrow.style.top = `${ay}px`;
    arrow.style.transform = `rotate(${-arrowAngle}deg)`;
    wrap.appendChild(arrow);
    ringArrows.push(arrow);
  }

  const logoSize = Math.round(220 * 2 / 3);
  const logo = document.createElement('div');
  logo.id = 'umbrella-logo';
  logo.style.width = `${logoSize}px`;
  logo.style.height = `${logoSize}px`;
  logo.innerHTML = UMBRELLA_SVG;
  wrap.appendChild(logo);

  rightPane!.insertBefore(wrap, rightPane!.querySelector('#safe-grid')!);
}

function buildGrid(): void {
  const grid = rightPane!.querySelector('#safe-grid') as HTMLElement;
  grid.innerHTML = '';
  gridBtns = [];

  for (let row = 0; row < gridSize; row++) {
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
}

export const portableSafe: PuzzleModule = {
  id: 'portableSafe',
  slug: 'portable-safe',
  sourceGame: 're2r',
  name: 'Portable Safe',

  create(c: HTMLElement, context: PuzzleContext) {
    container = c;
    ctx = context;

    const layout = document.createElement('div');
    layout.id = 'safe-layout';
    container.appendChild(layout);

    const leftPane = document.createElement('div');
    leftPane.id = 'safe-left';
    layout.appendChild(leftPane);

    const diffWrap = document.createElement('div');
    diffWrap.id = 'diff-selector';
    diffBtns = SIZES.map(n => {
      const btn = document.createElement('button');
      btn.className = 'diff-btn';
      btn.dataset.size = String(n);
      btn.textContent = `2×${n}`;
      btn.addEventListener('click', () => setGridSize(n));
      diffWrap.appendChild(btn);
      return btn;
    });
    leftPane.appendChild(diffWrap);

    rightPane = document.createElement('div');
    rightPane.id = 'safe-right';
    layout.appendChild(rightPane);

    const grid = document.createElement('div');
    grid.id = 'safe-grid';
    rightPane.appendChild(grid);

    ringLights = [];
    ringArrows = [];
    numBtns = gridSize * 2;
    setGridSize(gridSize);

    ctx.setActions([
      { label: 'New Puzzle', handler: () => { if (!playing) generatePuzzle(); } },
      { label: 'Reset', handler: resetPuzzle },
    ]);

    return {
      destroy(): void {
        ringLights = [];
        ringArrows = [];
        gridBtns = [];
        diffBtns = [];
        rightPane = null;
        container!.innerHTML = '';
        container = null;
        ctx = null;
      },
    };
  },
};
