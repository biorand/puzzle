import { initAudioOnFirstClick, playChime, playTone, playMelody as pMelody } from './audio';
import { createMelodyPage } from './melody';
import { puzzleOrder, puzzles, puzzlesByPath } from './puzzles/index';
import type { ActionButton, PuzzleContext, PuzzleModule, StatusInfo } from './types';
import { createFooter, createHeader, createMenu, createOverlay, createStatusBar } from './ui';

const app = document.getElementById('app')!;
let currentPuzzle: { destroy(): void } | null = null;

function getScore(id: string): number {
  return parseInt(localStorage.getItem(`repuzzles-${id}-score`) || '0', 10);
}

function setScore(id: string, n: number): void {
  localStorage.setItem(`repuzzles-${id}-score`, String(n));
}

// ── Unlock / progression state ──

interface UnlockData {
  tutorialStep: number;
  unlockedAll: boolean;
}

function getUnlockData(): UnlockData {
  try {
    const raw = localStorage.getItem('repuzzles-unlock');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { tutorialStep: 0, unlockedAll: false };
}

function saveUnlockData(data: UnlockData): void {
  localStorage.setItem('repuzzles-unlock', JSON.stringify(data));
}

function isUnlocked(puzzleId: string): boolean {
  const data = getUnlockData();
  if (data.unlockedAll) return true;
  if (puzzleId === 'door01') return true;

  const idx = puzzleOrder.indexOf(puzzleId);
  if (idx <= 0) return false;

  // Each puzzle requires the previous one to be completed enough
  const prevId = puzzleOrder[idx - 1];
  if (prevId === 'door01') return data.tutorialStep >= 5;
  return getScore(prevId) >= 1;
}

function getRequirementLabel(id: string): string | undefined {
  if (isUnlocked(id)) return undefined;
  const idx = puzzleOrder.indexOf(id);
  if (idx <= 0) return undefined;
  const prevId = puzzleOrder[idx - 1];
  const prevPuzzle = puzzles.get(prevId);
  if (!prevPuzzle) return undefined;
  return `🔒 Complete ${prevPuzzle.name}`;
}

function showMenu(): void {
  app.innerHTML = '';
  const entries = puzzleOrder
    .map(id => puzzles.get(id)!)
    .filter(Boolean)
    .map(p => ({
      id: p.id,
      name: p.name,
      unlocked: isUnlocked(p.id),
      requirementLabel: getRequirementLabel(p.id),
    }));
  app.appendChild(createMenu(entries, onPuzzleSelect));
}

function startPuzzle(mod: PuzzleModule): void {
  if (!isUnlocked(mod.id)) {
    location.hash = '#/';
    return;
  }

  const id = mod.id;
  app.innerHTML = '';

  const header = createHeader(mod.name, onBack);
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
  const unlockEl = document.getElementById('completed-unlock')!;
  const unlockNameEl = document.getElementById('completed-unlock-name')!;

  // Determine tutorial state for door01
  let tutorialStep: number | undefined;
  let forceDifficulty: number | undefined;
  if (mod.id === 'door01') {
    const data = getUnlockData();
    if (!data.unlockedAll && data.tutorialStep < 5) {
      tutorialStep = data.tutorialStep;
      forceDifficulty = [1, 1, 2, 2, 3][data.tutorialStep];
    }
  }

  const ctx: PuzzleContext = {
    setStatus(info: StatusInfo): void {
      movesNum.textContent = String(info.moves);
      if (info.optimal !== undefined)
        optimalNum.textContent = String(info.optimal);
    },

    setActions(buttons: ActionButton[]): void {
      const existing = document.getElementById('app-footer');
      if (existing) existing.remove();
      app.appendChild(createFooter(buttons));
    },

    async showOverlay(nextMod?: PuzzleModule): Promise<void> {
      overlayText.textContent = 'COMPLETED';
      if (nextMod) {
        unlockNameEl.textContent = nextMod.name;
        unlockEl.style.display = '';
        pMelody('C4/4 E4/4 G4/4 C5/4');
        overlay.classList.remove('hidden');
        await new Promise(r => setTimeout(r, 3000));
        overlay.classList.add('hidden');
        unlockEl.style.display = 'none';
        location.hash = `#/${nextMod.sourceGame}/${nextMod.slug}`;
      } else {
        unlockEl.style.display = 'none';
        overlay.classList.remove('hidden');
        await new Promise(r => setTimeout(r, 2000));
        overlay.classList.add('hidden');
      }
    },

    hideOverlay(): void {
      overlay.classList.add('hidden');
    },

    playTone,
    playChime,
    playMelody: pMelody,

    forceDifficulty,
    tutorialStep,
    tutorialTotal: 5,

    score: {
      get count(): number {
        return getScore(id);
      },
      increment(): PuzzleModule | null {
        const idx = puzzleOrder.indexOf(mod.id);
        const nextId = (idx >= 0 && idx < puzzleOrder.length - 1) ? puzzleOrder[idx + 1] : null;
        const wasNextUnlocked = nextId ? isUnlocked(nextId) : true;

        const n = getScore(id) + 1;
        setScore(id, n);
        scoreNum.textContent = String(n);

        // Advance door01 tutorial step
        if (mod.id === 'door01') {
          const data = getUnlockData();
          if (!data.unlockedAll && data.tutorialStep < 5) {
            data.tutorialStep++;
            saveUnlockData(data);
            // Update ctx for next generated puzzle
            if (data.tutorialStep < 5) {
              ctx.forceDifficulty = [1, 1, 2, 2, 3][data.tutorialStep];
              ctx.tutorialStep = data.tutorialStep;
            } else {
              ctx.forceDifficulty = undefined;
              ctx.tutorialStep = undefined;
            }
          }
        }

        // Check if this completion unlocks the next puzzle
        if (nextId) {
          const nowUnlocked = isUnlocked(nextId);
          if (!wasNextUnlocked && nowUnlocked) {
            return puzzles.get(nextId) || null;
          }
        }
        return null;
      },
    },

    onCheatUnlockAll: (playMelodyFn?: () => Promise<void>) => {
      const data = getUnlockData();
      data.unlockedAll = true;
      saveUnlockData(data);
      if (playMelodyFn) {
        // Show "ALL PUZZLES UNLOCKED" while fanfare plays, then go to menu
        unlockNameEl.textContent = 'ALL PUZZLES';
        unlockEl.style.display = '';
        overlayText.textContent = 'CHEAT ACTIVATED';
        overlay.classList.remove('hidden');
        playMelodyFn().then(() => {
          setTimeout(() => {
            overlay.classList.add('hidden');
            unlockEl.style.display = 'none';
            location.hash = '#/';
          }, 500);
        });
      } else {
        playChime();
        setTimeout(() => { location.hash = '#/'; }, 2200);
      }
    },
  };

  currentPuzzle = mod.create(container, ctx);
}

function onPuzzleSelect(id: string): void {
  const mod = puzzles.get(id);
  if (!mod) return;
  location.hash = `#/${mod.sourceGame}/${mod.slug}`;
}

function onBack(): void {
  location.hash = '#/';
}

function router(): void {
  if (currentPuzzle) {
    currentPuzzle.destroy();
    currentPuzzle = null;
  }

  const hash = location.hash.replace(/^#\/?/, '') || '/';

  // Hash is empty or just '#' → show menu
  if (hash === '/' || hash === '') {
    showMenu();
    return;
  }

  // Hidden melody composer page
  if (hash === 'melody') {
    const header = createHeader('Melody Composer', () => { location.hash = '#/'; });
    app.appendChild(header);

    const container = document.createElement('div');
    container.id = 'puzzle-container';
    app.appendChild(container);

    currentPuzzle = createMelodyPage(container, () => { location.hash = '#/'; });
    return;
  }

  const match = hash.match(/^([^/]+)\/([^/]+)/);
  if (match) {
    const key = `${match[1]}/${match[2]}`;
    const mod = puzzlesByPath.get(key);
    if (mod) {
      startPuzzle(mod);
      return;
    }
  }

  showMenu();
}

window.addEventListener('hashchange', router);
router();
initAudioOnFirstClick();
