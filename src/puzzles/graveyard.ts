import type { PuzzleContext, PuzzleModule } from '../types';

const N = 7;
const STEPS = [3, 4];
const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
let currentSymbols: string[] = [];

const UMBRELLA_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M50,50 L90,50 Q70.48,58.48 78.28,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,78.28 Q58.48,70.48 50,90 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,90 Q41.52,70.48 21.72,78.28 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,78.28 Q29.52,58.48 10,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L10,50 Q29.52,41.52 21.72,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L21.72,21.72 Q41.52,29.52 50,10 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L50,10 Q58.48,29.52 78.28,21.72 Z" fill="#cc0000" stroke="#000" stroke-width="1.2"/>
  <path d="M50,50 L78.28,21.72 Q70.48,41.52 90,50 Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
</svg>`;

// ── BFS precomputation ──

const TOTAL_STATES = N * (1 << N);
const bfsDist = new Int16Array(TOTAL_STATES).fill(-1);

function stateIdx(pos: number, mask: number): number {
  return pos * (1 << N) + mask;
}

// BFS from initial state (pos=0, mask=0)
{
  const q: number[] = [stateIdx(0, 0)];
  bfsDist[stateIdx(0, 0)] = 0;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const pos = Math.floor(cur / (1 << N));
    const mask = cur % (1 << N);
    const d = bfsDist[cur];
    for (const step of STEPS) {
      const np = (pos + step) % N;
      const nm = mask ^ (1 << np);
      const ni = stateIdx(np, nm);
      if (bfsDist[ni] === -1) {
        bfsDist[ni] = d + 1;
        q.push(ni);
      }
    }
  }
}

// Collect all reachable target masks (exactly 2 bits set) with optimal moves
const reachableTargets: Array<{ mask: number; optimal: number }> = [];
for (let b1 = 0; b1 < N; b1++) {
  for (let b2 = b1 + 1; b2 < N; b2++) {
    const mask = (1 << b1) | (1 << b2);
    let best = -1;
    for (let p = 0; p < N; p++) {
      const d = bfsDist[stateIdx(p, mask)];
      if (d !== -1 && (best === -1 || d < best)) best = d;
    }
    if (best !== -1) {
      reachableTargets.push({ mask, optimal: best });
    }
  }
}

function shufflePick(arr: string[], n: number): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ── State ──

let pos = 0;
let lights = 0;
let targetMask = 0;
let moves = 0;
let optimal = 0;
let playing = false;
let pointerAngle = 0;

// DOM refs
let symbolEls: HTMLDivElement[] = [];
let goalEls: HTMLSpanElement[] = [];
let pointerEl: HTMLDivElement | null = null;
let btnEls: HTMLButtonElement[] = [];
let moving = false;
let ctx: PuzzleContext | null = null;

// ── Game logic ──

function generatePuzzle(): void {
  currentSymbols = shufflePick(ZODIAC, N);
  const r = reachableTargets[Math.floor(Math.random() * reachableTargets.length)];
  targetMask = r.mask;
  optimal = r.optimal;
  pos = 0;
  lights = 0;
  moves = 0;
  playing = false;
  pointerAngle = 0;
  render();
}

function resetPuzzle(): void {
  pos = 0;
  lights = 0;
  moves = 0;
  playing = false;
  pointerAngle = 0;
  render();
}

function render(): void {
  for (let i = 0; i < N; i++) {
    const sym = symbolEls[i];
    if (sym) {
      sym.textContent = currentSymbols[i];
      sym.classList.toggle('on', !!(lights & (1 << i)));
    }
    const isTarget = !!(targetMask & (1 << i));
    if (goalEls[i]) {
      goalEls[i].textContent = currentSymbols[i];
      goalEls[i].hidden = !isTarget;
      goalEls[i].classList.toggle('target', isTarget);
    }
  }
  if (pointerEl) {
    pointerEl.style.transform = `rotate(${pointerAngle}deg)`;
  }
  if (ctx) ctx.setStatus({ moves, optimal });
}

function press(step: number): void {
  if (playing || moving || !ctx) return;
  moving = true;
  for (const btn of btnEls) btn.disabled = true;

  pos = (pos + step) % N;
  lights ^= 1 << pos;
  moves++;
  pointerAngle += (step / N) * 360;
  ctx.playTone(pos / N);
  render();

  // Wait for pointer CSS transition to finish (250ms)
  setTimeout(() => {
    moving = false;
    for (const btn of btnEls) btn.disabled = false;
    if (lights === targetMask) completeAnimation();
  }, 280);
}

async function completeAnimation(): Promise<void> {
  if (!ctx) return;
  playing = true;
  ctx.setActions([]);
  ctx.playChime();

  for (let f = 0; f < 5; f++) {
    for (const el of symbolEls) el.classList.add('flash');
    await new Promise((r) => setTimeout(r, 150));
    for (const el of symbolEls) el.classList.remove('flash');
    await new Promise((r) => setTimeout(r, 150));
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
        if (!playing) resetPuzzle();
      },
    },
  ]);
  playing = false;
}

// ── Module ──

export const graveyard: PuzzleModule = {
  id: 'graveyard',
  slug: 'graveyard',
  sourceGame: 're4',
  name: 'Graveyard',

  create(c: HTMLElement, context: PuzzleContext) {
    ctx = context;

    const layout = document.createElement('div');
    layout.id = 'graveyard-layout';
    c.appendChild(layout);

    // ── Dial area (flexes to fill space) ──
    const dialArea = document.createElement('div');
    dialArea.id = 'graveyard-dial-area';
    layout.appendChild(dialArea);

    // ── Ring with symbols ──
    const ringWrap = document.createElement('div');
    ringWrap.id = 'graveyard-ring-wrap';
    dialArea.appendChild(ringWrap);

    symbolEls = [];
    for (let i = 0; i < N; i++) {
      const el = document.createElement('div');
      el.className = 'graveyard-symbol';
      el.textContent = '';
      ringWrap.appendChild(el);
      symbolEls.push(el);
    }

    // ── Pointer (triangle at center) ──
    const ptr = document.createElement('div');
    ptr.id = 'graveyard-pointer';
    ringWrap.appendChild(ptr);
    pointerEl = ptr;

    // ── Logo ──
    const logo = document.createElement('div');
    logo.id = 'graveyard-logo';
    logo.innerHTML = UMBRELLA_SVG;
    ringWrap.appendChild(logo);

    // ── Position dial based on actual space ──
    function positionDial() {
      const parent = dialArea;
      const parentW = parent.clientWidth;
      const parentH = parent.clientHeight;
      const S = Math.min(parentW, parentH, 500);
      ringWrap.style.width = S + 'px';
      ringWrap.style.height = S + 'px';

      const cx = S / 2,
        cy = S / 2,
        r = S * 0.4;
      const symSize = Math.round(S * 0.17);
      const fontSize = Math.round(S * 0.085);
      const ptrLen = Math.round(S * 0.37);
      const ptrW = Math.max(Math.round(S * 0.028), 5);
      const logoSize = Math.round(S * 0.52);

      for (let i = 0; i < N; i++) {
        const angleDeg = (360 / N) * i - 90;
        const rad = (angleDeg * Math.PI) / 180;
        const el = symbolEls[i];
        el.style.left = `${cx + r * Math.cos(rad)}px`;
        el.style.top = `${cy + r * Math.sin(rad)}px`;
        el.style.width = `${symSize}px`;
        el.style.height = `${symSize}px`;
        el.style.marginLeft = `${-symSize / 2}px`;
        el.style.marginTop = `${-symSize / 2}px`;
        el.style.fontSize = `${fontSize}px`;
      }

      pointerEl.style.borderLeftWidth = `${ptrW}px`;
      pointerEl.style.borderRightWidth = `${ptrW}px`;
      pointerEl.style.borderBottomWidth = `${ptrLen}px`;
      pointerEl.style.marginLeft = `${-ptrW}px`;
      pointerEl.style.marginTop = `${-ptrLen}px`;
      pointerEl.style.transformOrigin = `${ptrW}px ${ptrLen}px`;

      logo.style.width = `${logoSize}px`;
      logo.style.height = `${logoSize}px`;
    }

    requestAnimationFrame(() => positionDial());

    // ── Goal row ──
    const goalRow = document.createElement('div');
    goalRow.id = 'graveyard-goal';
    layout.appendChild(goalRow);

    const goalLabel = document.createElement('span');
    goalLabel.className = 'graveyard-goal-label';
    goalLabel.textContent = 'Goal:';
    goalRow.appendChild(goalLabel);

    goalEls = [];
    for (let i = 0; i < N; i++) {
      const g = document.createElement('span');
      g.className = 'graveyard-goal-symbol';
      g.textContent = '';
      g.hidden = true;
      goalRow.appendChild(g);
      goalEls.push(g);
    }

    // ── Buttons ──
    const btnRow = document.createElement('div');
    btnRow.id = 'graveyard-btns';
    layout.appendChild(btnRow);

    btnEls = [];
    for (const step of STEPS) {
      const btn = document.createElement('button');
      btn.className = 'graveyard-btn';
      btn.textContent = String(step);
      btn.addEventListener('click', () => press(step));
      btnRow.appendChild(btn);
      btnEls.push(btn);
    }

    // ── Init ──
    generatePuzzle();
    // reposition after fonts load too
    setTimeout(() => positionDial(), 100);
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

    return {
      destroy() {
        symbolEls = [];
        goalEls = [];
        btnEls = [];
        pointerEl = null;
        ctx = null;
        c.innerHTML = '';
        playing = false;
      },
    };
  },
};
