import type { PuzzleContext, PuzzleModule } from '../types';

const TOGGLES: number[][] = [
  [0, 1],
  [0, 1, 2],
  [1, 2, 3],
  [2, 3],
];

const LABELS = ['A', 'B', 'C', 'D'] as const;
const OPTIMAL_MAP = [3, 2, 2, 3];

let lights: boolean[] = [];
let stage = 0;
let stageTargets: number[] = [];
let completedStages: boolean[] = [];
let playing = false;
let totalMoves = 0;
let optimal = 0;
let stageInitialStates: boolean[][] = [];

let lightEls: HTMLDivElement[] = [];
let labelEls: HTMLDivElement[] = [];
let circleEls: HTMLDivElement[] = [];

let containerEl: HTMLElement | null = null;
let ctx: PuzzleContext | null = null;

function generateTargets(): void {
  stageTargets = [];
  stageInitialStates = [];
  stageTargets[0] = Math.floor(Math.random() * 4);
  for (let i = 1; i < 3; i++) {
    let t: number;
    do {
      t = Math.floor(Math.random() * 4);
    } while (t === stageTargets[i - 1]);
    stageTargets[i] = t;
  }
  for (let i = 0; i < 3; i++) {
    let state: boolean[];
    do {
      state = Array.from({ length: 4 }, () => Math.random() < 0.5);
    } while (state.every((v, j) => v === (j === stageTargets[i])));
    stageInitialStates[i] = state;
  }
  optimal =
    OPTIMAL_MAP[stageTargets[0]] + OPTIMAL_MAP[stageTargets[1]] + OPTIMAL_MAP[stageTargets[2]];
}

function resetState(): void {
  lights = stageInitialStates[0]?.slice() ?? [false, false, false, false];
  stage = 0;
  completedStages = [false, false, false];
  playing = false;
  totalMoves = 0;
}

function generatePuzzle(): void {
  generateTargets();
  resetState();
  ctx?.playTone(1);
  render();
}

function resetPuzzle(): void {
  resetState();
  ctx?.playTone(1);
  render();
}

function render(): void {
  const target = stageTargets[stage];
  for (let i = 0; i < 4; i++) {
    lightEls[i].classList.toggle('on', lights[i]);
    labelEls[i].classList.toggle('target', i === target);
  }
  for (let i = 0; i < 3; i++) {
    circleEls[i].classList.toggle('on', completedStages[i]);
  }
  if (ctx) {
    ctx.setStatus({ moves: totalMoves, optimal });
  }
}

function toggle(idx: number): void {
  for (const t of TOGGLES[idx]) {
    lights[t] = !lights[t];
  }
}

function checkStageComplete(): boolean {
  const target = stageTargets[stage];
  for (let i = 0; i < 4; i++) {
    if (i === target && !lights[i]) return false;
    if (i !== target && lights[i]) return false;
  }
  return true;
}

function press(idx: number): void {
  if (playing || !ctx) return;
  toggle(idx);
  totalMoves++;
  ctx.playTone(idx / 3);
  render();
  if (checkStageComplete()) {
    completeStage();
  }
}

async function completeStage(): Promise<void> {
  if (!ctx) return;
  playing = true;
  const target = stageTargets[stage];

  for (let f = 0; f < 3; f++) {
    ctx.playTone(0.5);
    lightEls[target].classList.add('flash');
    labelEls[target].classList.add('flash');
    await new Promise((r) => setTimeout(r, 200));
    lightEls[target].classList.remove('flash');
    labelEls[target].classList.remove('flash');
    await new Promise((r) => setTimeout(r, 200));
  }

  completedStages[stage] = true;

  if (stage === 2) {
    render();

    for (let f = 0; f < 5; f++) {
      ctx.playTone(0.5);
      for (let i = 0; i < 4; i++) {
        lightEls[i].classList.add('flash');
        labelEls[i].classList.add('flash');
        lightEls[i].classList.add('on');
      }
      await new Promise((r) => setTimeout(r, 200));
      for (let i = 0; i < 4; i++) {
        lightEls[i].classList.remove('flash');
        labelEls[i].classList.remove('flash');
        lightEls[i].classList.remove('on');
      }
      await new Promise((r) => setTimeout(r, 200));
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
  } else {
    stage++;
    lights = stageInitialStates[stage].slice();
    ctx.playTone(1);
    render();

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
  }

  playing = false;
}

export const stagla: PuzzleModule = {
  id: 'stagla',
  slug: 'stagla',
  sourceGame: 're3',
  name: 'Stagla',

  create(c: HTMLElement, context: PuzzleContext) {
    containerEl = c;
    ctx = context;

    const top = document.createElement('div');
    top.id = 'stagla-top';

    const circles = document.createElement('div');
    circles.id = 'stagla-circles';
    circleEls = [];
    for (let i = 0; i < 3; i++) {
      const circle = document.createElement('div');
      circle.className = 'stagla-circle';
      circles.appendChild(circle);
      circleEls.push(circle);
    }
    top.appendChild(circles);

    const lightsArea = document.createElement('div');
    lightsArea.id = 'stagla-lights-area';

    const lightsRow = document.createElement('div');
    lightsRow.className = 'stagla-lights-row';

    lightEls = [];
    labelEls = [];
    for (let i = 0; i < 4; i++) {
      const light = document.createElement('div');
      light.className = 'stagla-light';
      light.addEventListener('click', () => press(i));
      lightsRow.appendChild(light);
      lightEls.push(light);
    }
    lightsArea.appendChild(lightsRow);

    const labelsRow = document.createElement('div');
    labelsRow.className = 'stagla-labels-row';
    for (let i = 0; i < 4; i++) {
      const label = document.createElement('div');
      label.className = 'stagla-label';
      label.textContent = LABELS[i];
      labelsRow.appendChild(label);
      labelEls.push(label);
    }
    lightsArea.appendChild(labelsRow);
    top.appendChild(lightsArea);

    c.appendChild(top);

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

    return {
      destroy() {
        lightEls = [];
        labelEls = [];
        circleEls = [];
        containerEl!.innerHTML = '';
        containerEl = null;
        ctx = null;
        playing = false;
      },
    };
  },
};
