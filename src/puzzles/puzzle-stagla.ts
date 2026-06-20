import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { playTone } from '../audio';
import { sleep, defaultActions } from './shared';
import { PuzzleBase } from './base';

const TOGGLES: number[][] = [
    [0, 1],
    [0, 1, 2],
    [1, 2, 3],
    [2, 3],
];

const LABELS = ['A', 'B', 'C', 'D'] as const;
const OPTIMAL_MAP = [3, 2, 2, 3];

export class PuzzleStagla extends PuzzleBase {
    @state() private _lights: boolean[] = [];
    @state() private _stage = 0;
    @state() private _completedStages: boolean[] = [];
    @state() private _totalMoves = 0;
    @state() private _optimal = 0;

    private _stageTargets: number[] = [];
    private _stageInitialStates: boolean[][] = [];

    private _generateTargets(): void {
        this._stageTargets = [];
        this._stageInitialStates = [];
        this._stageTargets[0] = Math.floor(Math.random() * 4);
        for (let i = 1; i < 3; i++) {
            let t: number;
            do {
                t = Math.floor(Math.random() * 4);
            } while (t === this._stageTargets[i - 1]);
            this._stageTargets[i] = t;
        }
        for (let i = 0; i < 3; i++) {
            let state: boolean[];
            do {
                state = Array.from({ length: 4 }, () => Math.random() < 0.5);
            } while (state.every((v, j) => v === (j === this._stageTargets[i])));
            this._stageInitialStates[i] = state;
        }
        this._optimal =
            OPTIMAL_MAP[this._stageTargets[0]] +
            OPTIMAL_MAP[this._stageTargets[1]] +
            OPTIMAL_MAP[this._stageTargets[2]];
    }

    _newPuzzle(): void {
        this._generateTargets();
        this._lights = this._stageInitialStates[0]?.slice() ?? [false, false, false, false];
        this._stage = 0;
        this._completedStages = [false, false, false];
        this._playing = false;
        this._totalMoves = 0;
        playTone(1);
        this._sendStatus(this._totalMoves, this._optimal);
    }

    private _resetPuzzle(): void {
        this._lights = this._stageInitialStates[0]?.slice() ?? [false, false, false, false];
        this._stage = 0;
        this._completedStages = [false, false, false];
        this._playing = false;
        this._totalMoves = 0;
        playTone(1);
        this._sendStatus(this._totalMoves, this._optimal);
    }

    private _toggle(idx: number): void {
        const next = [...this._lights];
        for (const t of TOGGLES[idx]) {
            next[t] = !next[t];
        }
        this._lights = next;
    }

    private _checkStageComplete(): boolean {
        const target = this._stageTargets[this._stage];
        for (let i = 0; i < 4; i++) {
            if (i === target && !this._lights[i]) return false;
            if (i !== target && this._lights[i]) return false;
        }
        return true;
    }

    private _press(idx: number): void {
        if (this._playing) return;
        this._toggle(idx);
        this._totalMoves++;
        playTone(idx / 3);
        this._sendStatus(this._totalMoves, this._optimal);
        if (this._checkStageComplete()) {
            this._completeStage();
        }
    }

    private async _completeStage(): Promise<void> {
        this._playing = true;
        const target = this._stageTargets[this._stage];

        for (let f = 0; f < 3; f++) {
            playTone(0.5);
            const lightEl = this.renderRoot.querySelector<HTMLElement>(
                `.stagla-light:nth-child(${target + 1})`,
            );
            const labelEl = this.renderRoot.querySelector<HTMLElement>(
                `.stagla-label:nth-child(${target + 1})`,
            );
            lightEl?.classList.add('flash');
            labelEl?.classList.add('flash');
            await sleep(200);
            lightEl?.classList.remove('flash');
            labelEl?.classList.remove('flash');
            await sleep(200);
        }

        const nextCompleted = [...this._completedStages];
        nextCompleted[this._stage] = true;
        this._completedStages = nextCompleted;

        if (this._stage === 2) {
            await this._completePuzzle();
            return;
        }

        this._stage++;
        this._lights = this._stageInitialStates[this._stage].slice();
        playTone(1);
        this._playing = false;
        this._syncActions();
    }

    private async _completePuzzle(): Promise<void> {
        this._syncActions();

        for (let f = 0; f < 5; f++) {
            playTone(0.5);
            const lights = this.renderRoot.querySelectorAll<HTMLElement>('.stagla-light');
            const labels = this.renderRoot.querySelectorAll<HTMLElement>('.stagla-label');
            for (const el of lights) {
                el.classList.add('flash');
                el.classList.add('on');
            }
            for (const el of labels) el.classList.add('flash');
            await sleep(200);
            for (const el of lights) {
                el.classList.remove('flash');
                el.classList.remove('on');
            }
            for (const el of labels) el.classList.remove('flash');
            await sleep(200);
        }

        this._sendComplete();
    }

    protected _syncActions(): void {
        this._sendActions(
            defaultActions(
                this._playing,
                () => this._newPuzzle(),
                () => this._resetPuzzle(),
            ),
        );
    }

    private _onLightClick(e: Event): void {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10);
        this._press(idx);
    }

    render() {
        const target = this._stageTargets[this._stage];
        return html`
            <div id="stagla-top">
                <div id="stagla-circles">
                    ${[0, 1, 2].map(
                        (i) => html`
                            <div
                                class="stagla-circle ${this._completedStages[i] ? 'on' : ''}"
                            ></div>
                        `,
                    )}
                </div>
                <div id="stagla-lights-area">
                    <div class="stagla-lights-row">
                        ${[0, 1, 2, 3].map(
                            (i) => html`
                                <div
                                    class="stagla-light ${this._lights[i] ? 'on' : ''}"
                                    @click=${this._onLightClick}
                                    data-idx=${i}
                                ></div>
                            `,
                        )}
                    </div>
                    <div class="stagla-labels-row">
                        ${[0, 1, 2, 3].map(
                            (i) => html`
                                <div class="stagla-label ${i === target ? 'target' : ''}">
                                    ${LABELS[i]}
                                </div>
                            `,
                        )}
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('puzzle-stagla', PuzzleStagla);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-stagla': PuzzleStagla;
    }
}
