import { LitElement, html } from 'lit';
import { state, property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { puzzleOrder, puzzles } from '../puzzles/index';
import { Rng } from '../rng';
import type { ActionButton, RunMode, RunConfig, RunResult, RunPuzzleResult } from '../types';
import { PUZZLE_VANILLA_COUNTS } from '../types';
import './app-footer';
import './settings-page';

function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeRank(totalMoves: number, totalOptimal: number): string {
    if (totalMoves === totalOptimal) return 'S+';
    const ratio = totalMoves / totalOptimal;
    if (ratio <= 1.5) return 'S';
    if (ratio <= 2.0) return 'A';
    if (ratio <= 2.5) return 'B';
    if (ratio <= 3.0) return 'C';
    return 'D';
}

export class RunHost extends LitElement {
    @property({ type: String }) mode: RunMode = 'random';

    @state() private _currentConfigIdx = 0;
    @state() private _puzzleKey = 0;
    @state() private _timer = 0;
    @state() private _currentMoves = 0;
    @state() private _currentOptimal = 0;
    @state() private _showQuitDialog = false;
    @state() private _actions: ActionButton[] = [];
    @state() private _penalties = 0;
    @state() private _subPage: 'puzzle' | 'settings' = 'puzzle';

    private _configs: RunConfig[] = [];
    private _results: RunPuzzleResult[] = [];
    private _puzzleStartTime = 0;
    private _runStartTime = 0;
    private _timerInterval: ReturnType<typeof setInterval> | null = null;

    createRenderRoot() {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this._initRun();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this._stopTimer();
    }

    private _onBack(): void {
        if (this._subPage === 'settings') {
            this._subPage = 'puzzle';
            return;
        }
        this._showQuitDialog = true;
    }

    private _onSettings(): void {
        this._subPage = 'settings';
    }

    private _onSettingsReset(): void {
        if (confirm('Reset all progress? This will not end your run.')) {
            localStorage.clear();
            this._subPage = 'puzzle';
        }
    }

    private _quitRun(): void {
        this._showQuitDialog = false;
        this._stopTimer();
        location.hash = '#/';
    }

    private _restartRun(): void {
        this._showQuitDialog = false;
        this._stopTimer();
        this._initRun();
    }

    private _cancelQuit(): void {
        this._showQuitDialog = false;
    }

    private _stopProp(e: Event): void {
        e.stopPropagation();
    }

    private _initRun(): void {
        this._configs = this._buildConfigs();
        this._results = [];
        this._currentConfigIdx = 0;
        this._puzzleKey = 0;
        this._runStartTime = Date.now();
        this._puzzleStartTime = Date.now();
        this._timer = 0;
        this._currentMoves = 0;
        this._currentOptimal = 0;
        this._actions = [];
        this._penalties = 0;
        this._startTimer();
    }

    private _buildConfigs(): RunConfig[] {
        const configs: RunConfig[] = [];
        const rng = new Rng();
        for (const puzzleId of puzzleOrder) {
            const count = PUZZLE_VANILLA_COUNTS[puzzleId] ?? 0;
            if (this.mode === 'vanilla' && count > 0) {
                for (let i = 0; i < count; i++) {
                    configs.push({
                        puzzleId,
                        configLabel: `Config ${i + 1}/${count}`,
                        seed: i,
                    });
                }
            } else {
                configs.push({
                    puzzleId,
                    configLabel: this.mode === 'vanilla' ? 'Vanilla' : 'Random',
                    seed: this.mode === 'vanilla' ? 1 : rng.nextInteger(1, 999999),
                });
            }
        }
        return configs;
    }

    private _getCurrentConfig(): RunConfig | null {
        return this._configs[this._currentConfigIdx] ?? null;
    }

    private _startTimer(): void {
        this._timerInterval = setInterval(() => {
            this._timer = Math.floor((Date.now() - this._runStartTime) / 1000);
        }, 1000);
    }

    private _stopTimer(): void {
        if (this._timerInterval !== null) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    private _onPuzzleStatus(e: CustomEvent): void {
        this._currentMoves = e.detail.moves;
        if (e.detail.optimal !== undefined) this._currentOptimal = e.detail.optimal;
    }

    private _onPuzzleActions(e: CustomEvent): void {
        const buttons = e.detail as ActionButton[];
        if (buttons.length === 0) return; // keep current buttons during completion animation
        if (this.mode === 'vanilla') {
            this._actions = buttons.filter((b) => b.label !== 'New Puzzle');
        } else {
            this._actions = buttons.map((b) => {
                if (b.label === 'New Puzzle') {
                    return {
                        label: 'New Puzzle',
                        handler: () => {
                            this._penalties++;
                            const config = this._getCurrentConfig();
                            if (config) {
                                config.seed = Math.floor(Math.random() * 999999) + 1;
                            }
                            this._puzzleKey++;
                            this._puzzleStartTime = Date.now();
                            this._actions = [];
                        },
                    };
                }
                return b;
            });
        }
    }

    private _onPuzzleComplete(_e: CustomEvent): void {
        const config = this._getCurrentConfig();
        if (!config) return;

        const puzzleElapsed = Math.floor((Date.now() - this._puzzleStartTime) / 1000);
        this._results.push({
            puzzleId: config.puzzleId,
            configLabel: config.configLabel,
            moves: this._currentMoves,
            optimal: this._currentOptimal,
            time: puzzleElapsed,
        });

        this._currentConfigIdx++;
        if (this._currentConfigIdx >= this._configs.length) {
            this._finishRun();
        } else {
            this._puzzleKey++;
            this._puzzleStartTime = Date.now();
            this._currentMoves = 0;
            this._currentOptimal = 0;
        }
    }

    private _finishRun(): void {
        this._stopTimer();
        const totalTime = Math.floor((Date.now() - this._runStartTime) / 1000);
        const totalMoves = this._results.reduce((s, r) => s + r.moves, 0);
        const totalOptimal = this._results.reduce((s, r) => s + r.optimal, 0);
        const penalizedMoves = totalMoves + this._penalties * 10;
        const result: RunResult = {
            mode: this.mode,
            date: new Date().toISOString(),
            totalTime,
            puzzles: this._results,
            totalMoves: penalizedMoves,
            totalOptimal,
            rank: computeRank(penalizedMoves, totalOptimal),
        };
        sessionStorage.setItem('repuzzles-run-result', JSON.stringify(result));
        location.hash = '#/run/results';
    }

    private _renderPuzzle() {
        const config = this._getCurrentConfig();
        if (!config) return null;
        const vanillaCount = PUZZLE_VANILLA_COUNTS[config.puzzleId] ?? 0;
        const vanillaIndex = this.mode === 'vanilla' && vanillaCount > 0 ? config.seed : -1;
        const rng = this.mode === 'random' ? new Rng(config.seed) : undefined;
        switch (config.puzzleId) {
            case 'keypad':
                return html`<puzzle-keypad
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-keypad>`;
            case 'vjolt':
                return html`<puzzle-vjolt
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-vjolt>`;
            case 'portableSafe':
                return html`<puzzle-portable-safe
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-portable-safe>`;
            case 'powerPanel':
                return html`<puzzle-power-panel
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-power-panel>`;
            case 'stagla':
                return html`<puzzle-stagla
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-stagla>`;
            case 'graveyard':
                return html`<puzzle-graveyard
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-graveyard>`;
            case 'slidingBlock':
                return html`<puzzle-sliding-block
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-sliding-block>`;
            case 'labPuzzle':
                return html`<puzzle-lab-puzzle
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-lab-puzzle>`;
            case 'plant43':
                return html`<puzzle-plant43
                    .rng=${rng}
                    .vanillaIndex=${vanillaIndex}
                    data-run-puzzle=${config.puzzleId}
                    @puzzle-status=${this._onPuzzleStatus}
                    @puzzle-complete=${this._onPuzzleComplete}
                    @puzzle-actions=${this._onPuzzleActions}
                ></puzzle-plant43>`;
            default:
                return null;
        }
    }

    render() {
        if (this._subPage === 'settings') {
            return html`
                <div class="run-page">
                    <app-header
                        title="Settings"
                        ?show-back=${true}
                        @back=${this._onBack}
                    ></app-header>
                    <settings-page @reset=${this._onSettingsReset}></settings-page>
                </div>
            `;
        }

        const config = this._getCurrentConfig();
        if (!config) {
            return html`<div class="run-page">
                <app-header
                    title="Run Complete!"
                    ?show-back=${true}
                    @back=${this._onBack}
                ></app-header>
                <p>Calculating results...</p>
            </div>`;
        }

        const puzzle = puzzles.get(config.puzzleId);
        const puzzleName = puzzle?.name ?? config.puzzleId;

        return html`
            <div class="run-page">
                <app-header
                    title="${this.mode === 'vanilla' ? 'Vanilla Run' : 'Random Run'}"
                    ?show-back=${true}
                    ?show-settings=${true}
                    @back=${this._onBack}
                    @settings=${this._onSettings}
                ></app-header>
                <div class="run-info-bar">
                    <span class="run-info-item">${puzzleName} — ${config.configLabel}</span>
                    <span class="run-info-item"
                        >${this._currentConfigIdx + 1} / ${this._configs.length}</span
                    >
                    <span class="run-info-item">${formatTime(this._timer)}</span>
                </div>
                ${keyed(this._puzzleKey, this._renderPuzzle())}
                <div class="run-info-bar run-info-bar-bottom">
                    <span class="run-info-item">Moves: ${this._currentMoves}</span>
                    <span class="run-info-item">Optimal: ${this._currentOptimal}</span>
                    ${this._penalties > 0
                        ? html`<span class="run-info-item run-penalty"
                              >Penalties: ${this._penalties}</span
                          >`
                        : ''}
                </div>
                <app-footer .buttons=${this._actions}></app-footer>
                ${this._showQuitDialog
                    ? html`
                          <div class="run-quit-overlay" @click=${this._cancelQuit}>
                              <div class="run-quit-dialog" @click=${this._stopProp}>
                                  <div class="run-quit-title">Abandon Run?</div>
                                  <div class="run-quit-desc">
                                      Your progress so far will not be saved.
                                  </div>
                                  <div class="run-quit-btns">
                                      <button
                                          class="run-quit-btn run-quit-btn-cancel"
                                          @click=${this._cancelQuit}
                                      >
                                          Continue
                                      </button>
                                      <button class="run-quit-btn" @click=${this._restartRun}>
                                          Restart
                                      </button>
                                      <button
                                          class="run-quit-btn run-quit-btn-quit"
                                          @click=${this._quitRun}
                                      >
                                          Quit
                                      </button>
                                  </div>
                              </div>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }
}

customElements.define('run-host', RunHost);

declare global {
    interface HTMLElementTagNameMap {
        'run-host': RunHost;
    }
}
