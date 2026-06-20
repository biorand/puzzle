import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { playChime, playTone } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { sleep } from './shared';

const SWITCH_COUNT = 5;
const START = 0;
const MIN = 0;
const MAX = 100;

interface SwitchValues {
    x: number;
    y: number;
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUniquePuzzle(): { values: SwitchValues[]; target: number } | null {
    for (let attempt = 0; attempt < 200; attempt++) {
        const bits: boolean[] = [true];
        for (let i = 1; i < SWITCH_COUNT; i++) bits.push(Math.random() < 0.5);
        const vals: SwitchValues[] = [];
        let pos = 0;
        let ok = true;
        for (let i = 0; i < SWITCH_COUNT; i++) {
            if (bits[i]) {
                const maxX = Math.min(50, 100 - pos);
                if (maxX < 8) {
                    ok = false;
                    break;
                }
                const x = randInt(8, maxX);
                const y = Math.min(pos + randInt(1, 8), 99);
                vals.push({ x, y });
                pos += x;
            } else {
                if (pos < 4) {
                    ok = false;
                    break;
                }
                const y = randInt(4, Math.min(30, pos));
                const x = Math.min(100 - pos + randInt(1, 8), 99);
                vals.push({ x, y });
                pos -= y;
            }
        }
        if (!ok || pos < 15 || pos > 95) continue;
        return { values: vals, target: pos };
    }
    return null;
}

export class PuzzlePowerPanel extends LitElement implements PuzzleLitElement {
    @state() private _switchValues: SwitchValues[] = [];
    @state() private _currentTarget = 50;
    @state() private _upDown: boolean[] = [];
    @state() private _switchIdx = 0;
    @state() private _needle = START;
    @state() private _won = false;
    @state() private _playing = false;
    @state() private _flashing = false;

    createRenderRoot() {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
        this._generatePuzzle();
        this._dispatchActions();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
    }

    regenerate(): void {
        this._generatePuzzle();
        this._dispatchActions();
    }

    private _onRegenerate(): void {
        this.regenerate();
    }

    private _generatePuzzle(): void {
        const puzzle = generateUniquePuzzle();
        if (!puzzle) {
            this._switchValues = [
                { x: 30, y: 5 },
                { x: 25, y: 8 },
                { x: 20, y: 12 },
                { x: 15, y: 99 },
                { x: 10, y: 99 },
            ];
            this._currentTarget = 80;
        } else {
            this._switchValues = puzzle.values;
            this._currentTarget = puzzle.target;
        }
        this._upDown = [];
        this._switchIdx = 0;
        this._needle = START;
        this._won = false;
        this._playing = false;
        this._flashing = false;
        this._dispatchStatus();
    }

    private _resetState(): void {
        this._upDown = [];
        this._switchIdx = 0;
        this._needle = START;
        this._won = false;
        this._playing = false;
        this._flashing = false;
    }

    private _playFailTone(): void {
        try {
            const actx = new (
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext
            )();
            if (actx.state === 'suspended') actx.resume();
            const now = actx.currentTime;
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.linearRampToValueAtTime(80, now + 0.25);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain).connect(actx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        } catch {
            /* audio may not be available */
        }
    }

    private async _flashAndReset(): Promise<void> {
        this._flashing = true;
        await sleep(50);
        this._flashing = false;
        await sleep(550);
        this._resetState();
    }

    private _onActionPress(e: Event): void {
        const isUp = (e.currentTarget as HTMLElement).dataset.direction === 'up';
        this._press(isUp);
    }

    private async _press(isUp: boolean): Promise<void> {
        if (this._switchIdx >= SWITCH_COUNT || this._won || this._playing) return;
        this._playing = true;

        const step = isUp
            ? this._switchValues[this._switchIdx].x
            : -this._switchValues[this._switchIdx].y;
        const next = this._needle + step;

        if (next < MIN || next > MAX) {
            this._needle = next < MIN ? MIN : MAX;
            await sleep(400);
            this._playFailTone();
            await this._flashAndReset();
            this._dispatchStatus();
            this._playing = false;
            this._dispatchActions();
            return;
        }

        this._upDown = [...this._upDown];
        this._upDown[this._switchIdx] = isUp;
        this._needle = next;
        this._switchIdx++;
        try {
            playTone(this._needle / MAX);
        } catch {
            /* audio may not be available */
        }

        if (this._switchIdx === SWITCH_COUNT) {
            if (this._needle === this._currentTarget) {
                this._won = true;
                this._playing = false;
                await this._completePuzzle();
            } else {
                this._playing = false;
                await this._flashAndReset();
                this._dispatchStatus();
                this._dispatchActions();
            }
        } else {
            this._playing = false;
        }
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._dispatchActions();
        playChime();

        const needleEl = this.renderRoot.querySelector<HTMLElement>('.pp-needle');
        if (needleEl) {
            for (let f = 0; f < 5; f++) {
                needleEl.style.opacity = '0';
                await sleep(120);
                needleEl.style.opacity = '1';
                await sleep(120);
            }
        }

        this.dispatchEvent(new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }));
    }

    private _dispatchStatus(): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves: this._switchIdx, optimal: SWITCH_COUNT },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _dispatchActions(): void {
        const buttons: ActionButton[] = this._playing
            ? []
            : [
                  {
                      label: 'New Puzzle',
                      handler: () => {
                          if (!this._playing) this._generatePuzzle();
                      },
                  },
                  {
                      label: 'Reset',
                      handler: () => {
                          if (!this._playing) this._resetState();
                      },
                  },
              ];
        this.dispatchEvent(
            new CustomEvent(PUZZLE_ACTIONS, {
                detail: buttons,
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        const needlePct = this._needle >= 0 ? Math.round((this._needle / MAX) * 100) : 0;
        return html` <div id="pp-layout">
            <div id="pp-meter">
                <div class="pp-meter-labels">
                    ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
                        (v) =>
                            html` <span class="pp-label" style=${styleMap({ left: `${v}%` })}
                                >${v}</span
                            >`,
                    )}
                </div>
                <div class="pp-meter-ticks">
                    ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
                        (v) =>
                            html` <div class="pp-tick" style=${styleMap({ left: `${v}%` })}></div>`,
                    )}
                </div>
                <div class="pp-meter-track">
                    <div class="pp-meter-red"></div>
                    <div
                        class="pp-target-marker"
                        style=${styleMap({ left: `${this._currentTarget}%` })}
                    ></div>
                </div>
                <div class="pp-needle-wrap">
                    <div class="pp-needle" style=${styleMap({ left: `${needlePct}%` })}></div>
                </div>
            </div>
            <div id="pp-switches">
                ${[0, 1, 2, 3, 4].map((i) => {
                    const isActive = i === this._switchIdx && !this._won;
                    const leverUp = this._upDown[i];
                    const leverSet = i < this._upDown.length;
                    let leverCls = 'pp-lever';
                    if (leverSet) leverCls += leverUp ? ' pp-up' : ' pp-down';
                    if (leverSet) leverCls += ' pp-set';
                    return html` <div class="pp-switch-col ${isActive ? 'pp-active' : ''}">
                        <div class="pp-step pp-step-up">+${this._switchValues[i]?.x ?? '?'}</div>
                        <div class="${leverCls}"></div>
                        <div class="pp-step pp-step-down">-${this._switchValues[i]?.y ?? '?'}</div>
                    </div>`;
                })}
            </div>
            <div id="pp-actions">
                <div id="pp-action-btns">
                    <button
                        class="pp-action-btn pp-btn-up"
                        data-direction="up"
                        @click=${this._onActionPress}
                        ?disabled=${this._switchIdx >= SWITCH_COUNT || this._won || this._playing}
                    >
                        ▲ UP
                        (+${this._switchIdx < SWITCH_COUNT
                            ? (this._switchValues[this._switchIdx]?.x ?? '?')
                            : '?'})
                    </button>
                    <button
                        class="pp-action-btn pp-btn-down"
                        data-direction="down"
                        @click=${this._onActionPress}
                        ?disabled=${this._switchIdx >= SWITCH_COUNT || this._won || this._playing}
                    >
                        ▼ DOWN
                        (-${this._switchIdx < SWITCH_COUNT
                            ? (this._switchValues[this._switchIdx]?.y ?? '?')
                            : '?'})
                    </button>
                </div>
            </div>
            <div
                id="pp-flash"
                style=${styleMap({
                    opacity: this._flashing ? '1' : '0',
                    transition: this._flashing ? 'none' : 'opacity 0.5s ease',
                })}
            ></div>
        </div>`;
    }
}

customElements.define('puzzle-power-panel', PuzzlePowerPanel);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-power-panel': PuzzlePowerPanel;
    }
}
