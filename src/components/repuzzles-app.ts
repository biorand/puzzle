import { LitElement, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { keyed } from 'lit/directives/keyed.js';
import { initAudioOnFirstClick } from '../audio';
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

function readStoredInt(key: string): number {
    const n = parseInt(localStorage.getItem(key) || '', 10);
    return Number.isFinite(n) ? n : 0;
}

const UNLOCKED_KEY = 'repuzzles-unlocked';
const LEGACY_PROGRESS_KEY = 'repuzzles-progress';

function readUnlockedPuzzles(): Set<string> {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (raw !== null) {
        try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return new Set(parsed.filter((v): v is string => typeof v === 'string'));
            }
        } catch {
            // corrupt data: treat as nothing unlocked
        }
        return new Set();
    }
    // Migrate the legacy linear progress value (progress N unlocked puzzles 0..N)
    const legacy = parseInt(localStorage.getItem(LEGACY_PROGRESS_KEY) ?? '', 10);
    if (Number.isFinite(legacy) && legacy >= 0) {
        const ids = puzzleOrder.slice(0, Math.min(legacy + 1, puzzleOrder.length));
        localStorage.setItem(UNLOCKED_KEY, JSON.stringify(ids));
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
        return new Set(ids);
    }
    return new Set();
}

function writeUnlockedPuzzles(ids: Iterable<string>): void {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...ids]));
}

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
        return readStoredInt(`repuzzles-${id}-score`);
    }

    private _setScore(id: string, n: number): void {
        localStorage.setItem(`repuzzles-${id}-score`, String(n));
    }

    private _getKeypadTutorial(): number {
        return readStoredInt('repuzzles-keypad-tutorial');
    }

    private _setKeypadTutorial(n: number): void {
        localStorage.setItem('repuzzles-keypad-tutorial', String(n));
    }

    private _isUnlocked(puzzleId: string): boolean {
        return readUnlockedPuzzles().has(puzzleId);
    }

    private _unlockPuzzle(puzzleId: string): void {
        if (!puzzles.has(puzzleId)) return;
        const unlocked = readUnlockedPuzzles();
        if (unlocked.has(puzzleId)) return;
        unlocked.add(puzzleId);
        writeUnlockedPuzzles(unlocked);
    }

    private _getRequirementLabel(id: string): string | undefined {
        if (this._isUnlocked(id)) return undefined;
        return '🔒 Complete in a run';
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

    private _onMelody(): void {
        location.hash = '#/melody';
    }

    private _onRunPuzzleComplete(e: CustomEvent<{ puzzleId: string }>): void {
        // Completing a puzzle in a run unlocks it for Quick Play
        this._unlockPuzzle(e.detail.puzzleId);
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

        // Increment per-puzzle score
        const n = this._getScore(puzzleId) + 1;
        this._setScore(puzzleId, n);
        this._score = n;

        // Advance the keypad tutorial (onboarding only; unlocks come from runs)
        if (puzzleId === 'keypad') {
            const step = this._getKeypadTutorial();
            if (step < 5) {
                const newStep = step + 1;
                this._setKeypadTutorial(newStep);
                this._activeTutorialStep = newStep < 5 ? newStep : undefined;
                this._activeForceDifficulty = newStep < 5 ? [1, 1, 2, 2, 3][newStep] : undefined;
            }
        }

        // Show the completion overlay, then regenerate
        this._overlayMessage = 'COMPLETED';
        this._overlayNextName = null;
        this._overlayOpen = true;
        await sleep(2000);
        this._overlayOpen = false;
        puzzleEl.dispatchEvent(
            new CustomEvent(PUZZLE_REGENERATE, { bubbles: true, composed: true }),
        );
    }

    private _onCheatUnlock(e: CustomEvent<{ playMelodyFn: Promise<void> }>): void {
        writeUnlockedPuzzles(puzzleOrder);
        this._overlayNextName = 'ALL PUZZLES';
        this._overlayMessage = 'CHEAT ACTIVATED';
        this._overlayOpen = true;
        // Fire-and-forget the melody — don't block the UI on audio.
        // The melody was already started in the keypad before the event was dispatched;
        // this is just a reference to the same Promise so we can safely ignore it.
        e.detail.playMelodyFn.catch(() => {});
        // Fixed delay before closing overlay and returning to menu.
        // Matches the pattern used by _onPuzzleComplete (fire audio then sleep).
        setTimeout(() => {
            this._overlayOpen = false;
            this._overlayNextName = null;
            location.hash = '#/';
        }, 3000);
    }

    private _renderLitPuzzle() {
        const tagName = RepuzzlesApp._PUZZLE_TAGS[this._activePuzzleId ?? ''];
        if (!tagName) return null;
        const tag = unsafeStatic(tagName);
        const isKeypad = this._activePuzzleId === 'keypad';
        return html`
            <${tag}
                @puzzle-status=${this._onPuzzleStatus}
                @puzzle-actions=${this._onPuzzleActions}
                @puzzle-complete=${this._onPuzzleComplete}
                @cheat-unlock-all=${this._onCheatUnlock}
                .tutorialStep=${isKeypad ? this._activeTutorialStep : nothing}
                .forceDifficulty=${isKeypad ? this._activeForceDifficulty : nothing}
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
            return html`
                <run-host
                    mode=${this._runMode}
                    @cheat-unlock-all=${this._onCheatUnlock}
                    @run-puzzle-complete=${this._onRunPuzzleComplete}
                ></run-host>
                <complete-overlay
                    ?open=${this._overlayOpen}
                    message=${this._overlayMessage}
                    .nextName=${this._overlayNextName}
                ></complete-overlay>
            `;
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
                @melody=${this._onMelody}
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
