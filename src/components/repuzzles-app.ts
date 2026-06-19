import { html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { initAudioOnFirstClick, playChime, playTone, playMelody as pMelody } from '../audio';
import { puzzleOrder, puzzles, puzzlesByPath } from '../puzzles/index';
import type { ActionButton, MenuEntry, PuzzleContext, PuzzleModule, StatusInfo } from '../types';
import './app-footer';
import './app-header';
import './complete-overlay';
import './melody-composer';
import './puzzle-host';
import './puzzle-menu';
import './status-bar';

interface UnlockData {
  tutorialStep: number;
  unlockedAll: boolean;
}

type Page = 'menu' | 'puzzle' | 'melody';

export class RepuzzlesApp extends LitElement {
  @property() private _page: Page = 'menu';
  @property() private _puzzleModule: PuzzleModule | null = null;
  @property() private _puzzleName = '';
  @property({ type: Number }) private _moves = 0;
  @property({ type: Number }) private _optimal = 0;
  @property({ type: Number }) private _score = 0;
  @property({ type: Array }) private _buttons: ActionButton[] = [];
  @property({ type: Boolean }) private _overlayOpen = false;
  @property() private _overlayMessage = 'COMPLETED';
  @property() private _overlayNextName: string | null = null;
  @property({ type: Array }) private _menuEntries: MenuEntry[] = [];
  @state() private _puzzleKey = 0;

  private _context: PuzzleContext | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('hashchange', this._router);
    initAudioOnFirstClick();
    this._router();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this._router);
  }

  // ── Router ──

  private _router = (): void => {
    const hash = location.hash.replace(/^#\/?/, '') || '/';

    if (hash === '/' || hash === '') {
      this._showMenu();
      return;
    }

    if (hash === 'melody') {
      this._page = 'melody';
      return;
    }

    const match = hash.match(/^([^/]+)\/([^/]+)/);
    if (match) {
      const key = `${match[1]}/${match[2]}`;
      const mod = puzzlesByPath.get(key);
      if (mod) {
        this._startPuzzle(mod);
        return;
      }
    }

    this._showMenu();
  };

  // ── Score / Progression ──

  private _getScore(id: string): number {
    return parseInt(localStorage.getItem(`repuzzles-${id}-score`) || '0', 10);
  }

  private _setScore(id: string, n: number): void {
    localStorage.setItem(`repuzzles-${id}-score`, String(n));
  }

  private _getUnlockData(): UnlockData {
    try {
      const raw = localStorage.getItem('repuzzles-unlock');
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { tutorialStep: 0, unlockedAll: false };
  }

  private _saveUnlockData(data: UnlockData): void {
    localStorage.setItem('repuzzles-unlock', JSON.stringify(data));
  }

  private _isUnlocked(puzzleId: string): boolean {
    const data = this._getUnlockData();
    if (data.unlockedAll) return true;
    if (puzzleId === 'keypad') return true;
    const idx = puzzleOrder.indexOf(puzzleId);
    if (idx <= 0) return false;
    const prevId = puzzleOrder[idx - 1];
    if (prevId === 'keypad') return data.tutorialStep >= 5;
    return this._getScore(prevId) >= 1;
  }

  private _getRequirementLabel(id: string): string | undefined {
    if (this._isUnlocked(id)) return undefined;
    const idx = puzzleOrder.indexOf(id);
    if (idx <= 0) return undefined;
    const prevId = puzzleOrder[idx - 1];
    const prevPuzzle = puzzles.get(prevId);
    if (!prevPuzzle) return undefined;
    return `🔒 Complete ${prevPuzzle.name}`;
  }

  // ── Navigation ──

  private _showMenu(): void {
    this._page = 'menu';
    this._menuEntries = puzzleOrder
      .map((id) => puzzles.get(id)!)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unlocked: this._isUnlocked(p.id),
        requirementLabel: this._getRequirementLabel(p.id),
      }));
  }

  private _onMenuSelect(e: CustomEvent): void {
    this._onPuzzleSelect(e.detail.id);
  }

  private _onPuzzleSelect(id: string): void {
    const mod = puzzles.get(id);
    if (!mod) return;
    location.hash = `#/${mod.sourceGame}/${mod.slug}`;
  }

  private _onBack(): void {
    location.hash = '#/';
  }

  // ── Puzzle Lifecycle ──

  private _startPuzzle(mod: PuzzleModule): void {
    if (!this._isUnlocked(mod.id)) {
      location.hash = '#/';
      return;
    }

    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    this._page = 'puzzle';
    this._puzzleName = mod.name;
    this._moves = 0;
    this._optimal = 0;
    this._score = this._getScore(mod.id);
    this._overlayOpen = false;
    this._overlayNextName = null;
    this._buttons = [];

    let tutorialStep: number | undefined;
    let forceDifficulty: number | undefined;
    if (mod.id === 'keypad') {
      const data = this._getUnlockData();
      if (!data.unlockedAll && data.tutorialStep < 5) {
        tutorialStep = data.tutorialStep;
        forceDifficulty = [1, 1, 2, 2, 3][data.tutorialStep];
      }
    }

    const ctx: PuzzleContext & { forceDifficulty?: number; tutorialStep?: number } = {
      setStatus(info: StatusInfo): void {
        self._moves = info.moves;
        if (info.optimal !== undefined) self._optimal = info.optimal;
      },

      setActions(buttons: ActionButton[]): void {
        self._buttons = [...buttons];
      },

      async showOverlay(nextMod?: PuzzleModule): Promise<void> {
        self._overlayMessage = 'COMPLETED';
        if (nextMod) {
          self._overlayNextName = nextMod.name;
          self._overlayOpen = true;
          pMelody('C4/4 E4/4 G4/4 C5/4');
          await new Promise((r) => setTimeout(r, 3000));
          self._overlayOpen = false;
          self._overlayNextName = null;
          location.hash = `#/${nextMod.sourceGame}/${nextMod.slug}`;
        } else {
          self._overlayNextName = null;
          self._overlayOpen = true;
          await new Promise((r) => setTimeout(r, 2000));
          self._overlayOpen = false;
        }
      },

      hideOverlay(): void {
        self._overlayOpen = false;
      },

      playTone,
      playChime,
      playMelody: pMelody,

      forceDifficulty,
      tutorialStep,
      tutorialTotal: 5,

      score: {
        get count(): number {
          return self._getScore(mod.id);
        },
        increment(): PuzzleModule | null {
          const idx = puzzleOrder.indexOf(mod.id);
          const nextId = idx >= 0 && idx < puzzleOrder.length - 1 ? puzzleOrder[idx + 1] : null;
          const wasNextUnlocked = nextId ? self._isUnlocked(nextId) : true;

          const n = self._getScore(mod.id) + 1;
          self._setScore(mod.id, n);
          self._score = n;

          // Advance keypad tutorial step
          if (mod.id === 'keypad') {
            const data = self._getUnlockData();
            if (!data.unlockedAll && data.tutorialStep < 5) {
              data.tutorialStep++;
              self._saveUnlockData(data);
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
            const nowUnlocked = self._isUnlocked(nextId);
            if (!wasNextUnlocked && nowUnlocked) {
              return puzzles.get(nextId) || null;
            }
          }
          return null;
        },
      },

      onCheatUnlockAll: (playMelodyFn?: () => Promise<void>) => {
        const data = self._getUnlockData();
        data.unlockedAll = true;
        self._saveUnlockData(data);
        if (playMelodyFn) {
          self._overlayNextName = 'ALL PUZZLES';
          self._overlayMessage = 'CHEAT ACTIVATED';
          self._overlayOpen = true;
          playMelodyFn().then(() => {
            setTimeout(() => {
              self._overlayOpen = false;
              self._overlayNextName = null;
              location.hash = '#/';
            }, 500);
          });
        } else {
          playChime();
          setTimeout(() => {
            location.hash = '#/';
          }, 2200);
        }
      },
    };

    this._context = ctx;

    // Force puzzle-host to re-create by incrementing key + changing module
    this._puzzleKey++;
    this._puzzleModule = mod;
  }

  // ── Render ──

  render() {
    if (this._page === 'melody') {
      return html`
        <app-header title="Melody Composer" ?show-back @back=${this._onBack}></app-header>
        <melody-composer></melody-composer>
      `;
    }

    if (this._page === 'puzzle') {
      return html`
        <app-header title=${this._puzzleName} ?show-back @back=${this._onBack}></app-header>
        ${keyed(
        this._puzzleKey,
        html`<puzzle-host .module=${this._puzzleModule} .context=${this._context}></puzzle-host>`,
      )}
        <status-bar
          .moves=${this._moves}
          .optimal=${this._optimal}
          .score=${this._score}
        ></status-bar>
        <app-footer .buttons=${this._buttons}></app-footer>
        <complete-overlay
          ?open=${this._overlayOpen}
          message=${this._overlayMessage}
          .nextName=${this._overlayNextName}
        ></complete-overlay>
      `;
    }

    // Menu page
    return html`
      <puzzle-menu .entries=${this._menuEntries} @select=${this._onMenuSelect}></puzzle-menu>
    `;
  }
}

customElements.define('repuzzles-app', RepuzzlesApp);

declare global {
  interface HTMLElementTagNameMap {
    'repuzzles-app': RepuzzlesApp;
  }
}
