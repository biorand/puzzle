import { LitElement, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { keyed } from 'lit/directives/keyed.js';
import { initAudioOnFirstClick, playMelody as pMelody } from '../audio';
import { puzzleOrder, puzzles, puzzlesByPath } from '../puzzles/index';
import '../puzzles/puzzle-graveyard';
import '../puzzles/puzzle-keypad';
import '../puzzles/puzzle-lab-puzzle';
import '../puzzles/puzzle-plant43';
import '../puzzles/puzzle-portable-safe';
import '../puzzles/puzzle-power-panel';
import '../puzzles/puzzle-sliding-block';
import '../puzzles/puzzle-stagla';
import '../puzzles/puzzle-vjolt';
import { sleep } from '../puzzles/shared';
import type { ActionButton, MenuEntry, Page, PuzzleModule, RunMode, StatusInfo } from '../types';
import { PUZZLE_REGENERATE } from '../types';
import './app-footer';
import './app-header';
import './complete-overlay';
import './melody-composer';
import './puzzle-menu';
import './puzzle-select';
import './run-host';
import './run-results';
import './settings-page';
import './status-bar';

export class RepuzzlesApp extends LitElement {
    @state() private _page: Page = 'menu';
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
    @state() private _runMode: RunMode = 'random';
    @state() private _previousHash = '/';
    @state() private _beforePuzzleHash = '#/';
    @state() private _beforeSettingsHash: string | null = null;

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
        const prevHash = this._previousHash;
        this._previousHash = hash;

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
            this._beforeSettingsHash = prevHash === 'settings' ? null : prevHash;
            return;
        }

        if (hash === 'run/vanilla') {
            this._runMode = 'vanilla';
            this._page = 'run';
            return;
        }

        if (hash === 'run/random') {
            this._runMode = 'random';
            this._page = 'run';
            return;
        }

        if (hash === 'run/results') {
            this._page = 'run-results';
            return;
        }

        if (hash === 'quickplay') {
            this._showPuzzleSelect();
            return;
        }

        const match = hash.match(/^([^/]+)\/([^/]+)/);
        if (match) {
            const key = `${match[1]}/${match[2]}`;
            const mod = puzzlesByPath.get(key);
            if (mod) {
                // Store previous page so back returns to the right place
                this._beforePuzzleHash = prevHash === 'quickplay' ? '#/quickplay' : '#/';
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

    private _showPuzzleSelect(): void {
        this._page = 'puzzle-select';
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

    private _onVanillaRun(): void {
        location.hash = '#/run/vanilla';
    }

    private _onRandomRun(): void {
        location.hash = '#/run/random';
    }

    private _onQuickPlay(): void {
        location.hash = '#/quickplay';
    }

    private _onPuzzleSelect(id: string): void {
        const mod = puzzles.get(id);
        if (!mod) return;
        this._beforePuzzleHash = this._page === 'puzzle-select' ? '#/quickplay' : '#/';
        location.hash = `#/${mod.sourceGame}/${mod.slug}`;
    }

    private _onBack(): void {
        if (this._page === 'puzzle') {
            location.hash = this._beforePuzzleHash;
        } else if (this._page === 'settings' && this._beforeSettingsHash) {
            const hash = this._beforeSettingsHash;
            this._beforeSettingsHash = null;
            location.hash = hash === 'menu' || hash === '/' ? '#/' : `#/${hash}`;
        } else {
            location.hash = '#/';
        }
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

        this._activeTutorialStep = undefined;
        this._activeForceDifficulty = undefined;
        if (mod.id === 'keypad') {
            const step = this._getKeypadTutorial();
            if (step < 5) {
                this._activeTutorialStep = step;
                this._activeForceDifficulty = [1, 1, 2, 2, 3][step];
            }
        }
        this._puzzleKey++;
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
                    this._activeTutorialStep = newStep;
                    this._activeForceDifficulty = [1, 1, 2, 2, 3][newStep];
                    (puzzleEl as unknown as Record<string, unknown>).tutorialStep =
                        this._activeTutorialStep;
                    (puzzleEl as unknown as Record<string, unknown>).forceDifficulty =
                        this._activeForceDifficulty;
                } else {
                    this._activeTutorialStep = undefined;
                    this._activeForceDifficulty = undefined;
                    (puzzleEl as unknown as Record<string, unknown>).tutorialStep = undefined;
                    (puzzleEl as unknown as Record<string, unknown>).forceDifficulty = undefined;
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
        const tagName = RepuzzlesApp._PUZZLE_TAGS[this._activePuzzleId ?? ''];
        if (!tagName) return null;
        const tag = unsafeStatic(tagName);
        const extra =
            this._activePuzzleId === 'keypad'
                ? html`.tutorialStep=${this._activeTutorialStep}
                  .forceDifficulty=${this._activeForceDifficulty}`
                : nothing;
        return html`
            <${tag}
                @puzzle-status=${this._onPuzzleStatus}
                @puzzle-actions=${this._onPuzzleActions}
                @puzzle-complete=${this._onPuzzleComplete}
                @cheat-unlock-all=${this._onCheatUnlock}
                ${extra}
            ></${tag}>`;
    }

    static _PUZZLE_TAGS: Record<string, string> = {
        keypad: 'puzzle-keypad',
        slidingBlock: 'puzzle-sliding-block',
        stagla: 'puzzle-stagla',
        graveyard: 'puzzle-graveyard',
        labPuzzle: 'puzzle-lab-puzzle',
        plant43: 'puzzle-plant43',
        portableSafe: 'puzzle-portable-safe',
        powerPanel: 'puzzle-power-panel',
        vjolt: 'puzzle-vjolt',
    };

    // ── Render ──

    render() {
        if (this._page === 'melody') {
            return html`
                <app-header
                    title="Melody Composer"
                    ?show-back=${true}
                    @back=${this._onBack}
                ></app-header>
                <melody-composer></melody-composer>
            `;
        }

        if (this._page === 'puzzle') {
            return html`
                <app-header
                    title=${this._puzzleName}
                    ?show-back=${true}
                    ?show-settings=${true}
                    @back=${this._onBack}
                    @settings=${this._onSettings}
                ></app-header>
                ${keyed(this._puzzleKey, this._renderLitPuzzle())}
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
                <app-header title="Settings" ?show-back=${true} @back=${this._onBack}></app-header>
                <settings-page @reset=${this._onResetAll}></settings-page>
            `;
        }

        if (this._page === 'run') {
            return html`<run-host mode=${this._runMode}></run-host>`;
        }

        if (this._page === 'run-results') {
            return html`<run-results></run-results>`;
        }

        if (this._page === 'puzzle-select') {
            return html`
                <app-header
                    title="Quick Play"
                    ?show-back=${true}
                    ?show-settings=${true}
                    @back=${this._onBack}
                    @settings=${this._onSettings}
                ></app-header>
                <puzzle-select
                    .entries=${this._menuEntries}
                    @select=${this._onMenuSelect}
                ></puzzle-select>
            `;
        }

        // Menu page
        return html`
            <app-header
                title="BioRand Puzzles"
                ?show-settings
                @settings=${this._onSettings}
            ></app-header>
            <puzzle-menu
                @vanilla-run=${this._onVanillaRun}
                @random-run=${this._onRandomRun}
                @quick-play=${this._onQuickPlay}
            ></puzzle-menu>
        `;
    }
}

customElements.define('repuzzles-app', RepuzzlesApp);

declare global {
    interface HTMLElementTagNameMap {
        'repuzzles-app': RepuzzlesApp;
    }
}
