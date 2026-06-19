import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { initAudioOnFirstClick, playChime, playTone, playMelody as pMelody } from '../audio';
import { puzzleOrder, puzzles, puzzlesByPath } from '../puzzles/index';
import { sleep } from '../puzzles/shared';
import { PUZZLE_REGENERATE } from '../types';
import type { ActionButton, MenuEntry, PuzzleContext, PuzzleModule, StatusInfo } from '../types';
import '../puzzles/puzzle-keypad';
import '../puzzles/puzzle-sliding-block';
import '../puzzles/puzzle-stagla';
import './app-footer';
import './app-header';
import './complete-overlay';
import './melody-composer';
import './settings-page';
import './puzzle-host';
import './puzzle-menu';
import './status-bar';

type Page = 'menu' | 'puzzle' | 'melody' | 'settings';

export class RepuzzlesApp extends LitElement {
    @state() private _page: Page = 'menu';
    @state() private _puzzleModule: PuzzleModule | null = null;
    @state() private _puzzleName = '';
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _score = 0;
    @state() private _buttons: ActionButton[] = [];
    @state() private _overlayOpen = false;
    @state() private _overlayMessage = 'COMPLETED';
    @state() private _overlayNextName: string | null = null;
    @state() private _menuEntries: MenuEntry[] = [];
    @state() private _puzzleKey = 0;
    @state() private _activePuzzleId: string | null = null;
    @state() private _activeTutorialStep: number | undefined;
    @state() private _activeForceDifficulty: number | undefined;

    private _context: PuzzleContext | null = null;
    private _convertedIds = new Set(['keypad', 'slidingBlock', 'stagla']);

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

        if (hash === 'settings') {
            this._page = 'settings';
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

    private _getProgress(): number {
        return parseInt(localStorage.getItem('repuzzles-progress') || '0', 10);
    }

    private _setProgress(n: number): void {
        localStorage.setItem('repuzzles-progress', String(n));
    }

    private _getKeypadTutorial(): number {
        return parseInt(localStorage.getItem('repuzzles-keypad-tutorial') || '0', 10);
    }

    private _setKeypadTutorial(n: number): void {
        localStorage.setItem('repuzzles-keypad-tutorial', String(n));
    }

    private _isUnlocked(puzzleId: string): boolean {
        return puzzleOrder.indexOf(puzzleId) <= this._getProgress();
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
        this._activePuzzleId = null;
        this._menuEntries = puzzleOrder
            .map((id) => puzzles.get(id)!)
            .filter(Boolean)
            .map((p) => ({
                id: p.id,
                name: p.name,
                thumbnail: p.thumbnail,
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

    private _onSettings(): void {
        location.hash = '#/settings';
    }

    private _onResetAll(): void {
        location.hash = '#/';
    }

    // ── Puzzle Lifecycle ──

    private _startPuzzle(mod: PuzzleModule): void {
        if (!this._isUnlocked(mod.id)) {
            location.hash = '#/';
            return;
        }

        this._page = 'puzzle';
        this._activePuzzleId = mod.id;
        this._puzzleName = mod.name;
        this._moves = 0;
        this._optimal = 0;
        this._score = this._getScore(mod.id);
        this._overlayOpen = false;
        this._overlayNextName = null;
        this._buttons = [];

        if (this._convertedIds.has(mod.id)) {
            // ── Lit puzzle component path ──
            this._activeTutorialStep = undefined;
            this._activeForceDifficulty = undefined;
            if (mod.id === 'keypad') {
                const step = this._getKeypadTutorial();
                if (step < 5) {
                    this._activeTutorialStep = step;
                    this._activeForceDifficulty = [1, 1, 2, 2, 3][step];
                }
            }
            this._puzzleModule = null;
            this._context = null;
            this._puzzleKey++;
        } else {
            // ── Legacy PuzzleHost path (unconverted puzzles) ──
            const self = this; // eslint-disable-line @typescript-eslint/no-this-alias

            let tutorialStep: number | undefined;
            let forceDifficulty: number | undefined;
            if (mod.id === 'keypad') {
                const step = this._getKeypadTutorial();
                if (step < 5) {
                    tutorialStep = step;
                    forceDifficulty = [1, 1, 2, 2, 3][step];
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
                        const nextId =
                            idx >= 0 && idx < puzzleOrder.length - 1 ? puzzleOrder[idx + 1] : null;
                        const wasNextUnlocked = nextId ? self._isUnlocked(nextId) : true;

                        const n = self._getScore(mod.id) + 1;
                        self._setScore(mod.id, n);
                        self._score = n;

                        if (mod.id === 'keypad') {
                            const step = self._getKeypadTutorial();
                            if (step < 5) {
                                const newStep = step + 1;
                                self._setKeypadTutorial(newStep);
                                if (newStep < 5) {
                                    ctx.forceDifficulty = [1, 1, 2, 2, 3][newStep];
                                    ctx.tutorialStep = newStep;
                                } else {
                                    ctx.forceDifficulty = undefined;
                                    ctx.tutorialStep = undefined;
                                    if (self._getProgress() < 1) self._setProgress(1);
                                }
                            }
                        } else {
                            const newProgress = Math.max(self._getProgress(), idx + 1);
                            self._setProgress(newProgress);
                        }

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
                    self._setProgress(puzzleOrder.length - 1);
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
            this._puzzleKey++;
            this._puzzleModule = mod;
        }
    }

    // ── Lit Puzzle Event Handlers ──

    private _onPuzzleStatus(e: CustomEvent<StatusInfo>): void {
        this._moves = e.detail.moves;
        if (e.detail.optimal !== undefined) this._optimal = e.detail.optimal;
    }

    private _onPuzzleActions(e: CustomEvent<ActionButton[]>): void {
        this._buttons = e.detail;
    }

    private async _onPuzzleComplete(e: CustomEvent): Promise<void> {
        const puzzleId = this._activePuzzleId;
        if (!puzzleId) return;
        const puzzleEl = e.target as HTMLElement;

        const idx = puzzleOrder.indexOf(puzzleId);
        const nextId = idx >= 0 && idx < puzzleOrder.length - 1 ? puzzleOrder[idx + 1] : null;
        const wasNextUnlocked = nextId ? this._isUnlocked(nextId) : true;

        // Increment per-puzzle score
        const n = this._getScore(puzzleId) + 1;
        this._setScore(puzzleId, n);
        this._score = n;

        // Handle keypad tutorial separately (all 5 steps before progress advances)
        if (puzzleId === 'keypad') {
            const step = this._getKeypadTutorial();
            if (step < 5) {
                const newStep = step + 1;
                this._setKeypadTutorial(newStep);
                if (newStep < 5) {
                    (puzzleEl as Record<string, unknown>).tutorialStep = newStep;
                    (puzzleEl as Record<string, unknown>).forceDifficulty = [1, 1, 2, 2, 3][
                        newStep
                    ];
                } else {
                    (puzzleEl as Record<string, unknown>).tutorialStep = undefined;
                    (puzzleEl as Record<string, unknown>).forceDifficulty = undefined;
                    if (this._getProgress() < 1) this._setProgress(1);
                }
            }
        } else {
            // Non-keypad puzzle: advance progress to unlock the next one
            const newProgress = Math.max(this._getProgress(), idx + 1);
            this._setProgress(newProgress);
        }

        // Check if this completion unlocks the next puzzle
        let nextMod: PuzzleModule | null = null;
        if (nextId) {
            const nowUnlocked = this._isUnlocked(nextId);
            if (!wasNextUnlocked && nowUnlocked) {
                nextMod = puzzles.get(nextId) || null;
            }
        }

        // Show overlay
        this._overlayMessage = 'COMPLETED';
        if (nextMod) {
            this._overlayNextName = nextMod.name;
            this._overlayOpen = true;
            pMelody('C4/4 E4/4 G4/4 C5/4');
            await sleep(3000);
            this._overlayOpen = false;
            this._overlayNextName = null;
            location.hash = `#/${nextMod.sourceGame}/${nextMod.slug}`;
        } else {
            this._overlayNextName = null;
            this._overlayOpen = true;
            await sleep(2000);
            this._overlayOpen = false;
            puzzleEl.dispatchEvent(
                new CustomEvent(PUZZLE_REGENERATE, { bubbles: true, composed: true }),
            );
        }
    }

    private _onCheatUnlock(e: CustomEvent<{ playMelodyFn: Promise<void> }>): void {
        this._setProgress(puzzleOrder.length - 1);
        this._overlayNextName = 'ALL PUZZLES';
        this._overlayMessage = 'CHEAT ACTIVATED';
        this._overlayOpen = true;
        e.detail.playMelodyFn.then(() => {
            setTimeout(() => {
                this._overlayOpen = false;
                this._overlayNextName = null;
                location.hash = '#/';
            }, 500);
        });
    }

    private _renderLitPuzzle() {
        switch (this._activePuzzleId) {
            case 'keypad':
                return html`<puzzle-keypad
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-actions=${this._onPuzzleActions}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @cheat-unlock-all=${this._onCheatUnlock}
                    .tutorialStep=${this._activeTutorialStep}
                    .forceDifficulty=${this._activeForceDifficulty}
                ></puzzle-keypad>`;
            case 'slidingBlock':
                return html`<puzzle-sliding-block
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-actions=${this._onPuzzleActions}
                    @puzzle-complete=${this._onPuzzleComplete}
                ></puzzle-sliding-block>`;
            case 'stagla':
                return html`<puzzle-stagla
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-actions=${this._onPuzzleActions}
                    @puzzle-complete=${this._onPuzzleComplete}
                ></puzzle-stagla>`;
            default:
                return null;
        }
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
            const isLit =
                this._activePuzzleId !== null && this._convertedIds.has(this._activePuzzleId);
            return html`
                <app-header title=${this._puzzleName} ?show-back @back=${this._onBack}></app-header>
                ${keyed(
                    this._puzzleKey,
                    isLit
                        ? this._renderLitPuzzle()
                        : html`<puzzle-host
                              .module=${this._puzzleModule}
                              .context=${this._context}
                          ></puzzle-host>`,
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

        if (this._page === 'settings') {
            return html`
                <app-header title="Settings" ?show-back @back=${this._onBack}></app-header>
                <settings-page @reset=${this._onResetAll}></settings-page>
            `;
        }

        // Menu page
        return html`
            <app-header
                title="BioRand Puzzles"
                ?show-settings
                @settings=${this._onSettings}
            ></app-header>
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
