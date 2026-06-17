import type { PuzzleContext, StatusInfo, ActionButton, PuzzleModule } from './types';
import { playTone, playChime, playMelody as pMelody, initAudioOnFirstClick } from './audio';
import { createHeader, createStatusBar, createFooter, createOverlay, createMenu } from './ui';
import { puzzles, puzzlesByPath } from './puzzles/index';

const app = document.getElementById('app')!;
let currentPuzzle: { destroy(): void } | null = null;

function getScore(id: string): number {
  return parseInt(localStorage.getItem(`repuzzles-${id}-score`) || '0', 10);
}

function setScore(id: string, n: number): void {
  localStorage.setItem(`repuzzles-${id}-score`, String(n));
}

function showMenu(): void {
  app.innerHTML = '';
  const entries = Array.from(puzzles.values()).map(p => ({
    id: p.id,
    name: p.name,
  }));
  app.appendChild(createMenu(entries, onPuzzleSelect));
}

function startPuzzle(mod: PuzzleModule): void {
  const id = mod.id;
  app.innerHTML = '';

  const header = createHeader(mod.name, getScore(id), onBack);
  app.appendChild(header);

  const container = document.createElement('div');
  container.id = 'puzzle-container';
  app.appendChild(container);

  const statusBar = createStatusBar();
  app.appendChild(statusBar);

  const overlay = createOverlay();
  app.appendChild(overlay);

  const movesNum = document.getElementById('moves-num')!;
  const optimalNum = document.getElementById('optimal-num')!;
  const scoreNum = document.getElementById('score-num')!;
  const overlayText = document.getElementById('complete-text')!;

  const ctx: PuzzleContext = {
    setStatus(info: StatusInfo): void {
      movesNum.textContent = String(info.moves);
      if (info.optimal !== undefined)
        optimalNum.textContent = String(info.optimal);
    },

    setActions(buttons: ActionButton[]): void {
      const existing = document.getElementById('app-footer');
      if (existing) existing.remove();
      if (buttons.length > 0) {
        app.appendChild(createFooter(buttons));
      }
    },

    async showOverlay(text: string, ms = 2000): Promise<void> {
      overlayText.textContent = text;
      overlay.classList.remove('hidden');
      await new Promise(r => setTimeout(r, ms));
      overlay.classList.add('hidden');
    },

    hideOverlay(): void {
      overlay.classList.add('hidden');
    },

    playTone,
    playChime,
    playMelody: pMelody,

    score: {
      get count(): number {
        return getScore(id);
      },
      increment(): void {
        const n = getScore(id) + 1;
        setScore(id, n);
        scoreNum.textContent = String(n);
      },
    },
  };

  currentPuzzle = mod.create(container, ctx);
}

function onPuzzleSelect(id: string): void {
  const mod = puzzles.get(id);
  if (!mod) return;
  const url = `/${mod.sourceGame}/${mod.slug}`;
  history.pushState({ puzzle: id }, '', url);
  startPuzzle(mod);
}

function onBack(): void {
  history.back();
}

function router(): void {
  if (currentPuzzle) {
    currentPuzzle.destroy();
    currentPuzzle = null;
  }

  const path = window.location.pathname.replace(/\/$/, '') || '/';

  if (path === '/') {
    showMenu();
    return;
  }

  const match = path.match(/^\/([^/]+)\/([^/]+)$/);
  if (match) {
    const key = `${match[1]}/${match[2]}`;
    const mod = puzzlesByPath.get(key);
    if (mod) {
      startPuzzle(mod);
      return;
    }
  }

  // Unknown path — fall back to menu
  showMenu();
}

window.addEventListener('popstate', router);
router();
initAudioOnFirstClick();
