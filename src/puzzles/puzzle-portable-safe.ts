import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { playChime, playMelody, playTone } from '../audio';
import { sleep } from './shared';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { UMBRELLA_SVG } from './shared';
import type { ActionButton, PuzzleLitElement } from '../types';

const GRID_SIZE = 4;
const NUM_BTNS = GRID_SIZE * 2;

const N = NUM_BTNS;
const cx = 50,
    cy = 50;
const rLight = 37.27,
    rArrow = 34.55;

interface LightPos {
    left: string;
    top: string;
    angle: number;
}
interface ArrowPos {
    left: string;
    top: string;
    rotate: string;
    angle: number;
}

const lightPositions: LightPos[] = [];
const arrowPositions: ArrowPos[] = [];

for (let i = 0; i < N; i++) {
    const lightAngle = (360 / N) * (i + 0.5);
    const la = (lightAngle * Math.PI) / 180;
    lightPositions.push({
        left: `${cx + rLight * Math.cos(la)}%`,
        top: `${cy - rLight * Math.sin(la)}%`,
        angle: lightAngle,
    });
    const arrowAngle = (360 / N) * (i + 1);
    const aa = (arrowAngle * Math.PI) / 180;
    arrowPositions.push({
        left: `${cx + rArrow * Math.cos(aa)}%`,
        top: `${cy - rArrow * Math.sin(aa)}%`,
        rotate: `${-arrowAngle}deg`,
        angle: arrowAngle,
    });
}

export class PuzzlePortableSafe extends LitElement implements PuzzleLitElement {
    @state() private _chain = 0;
    @state() private _startIdx = -1;
    @state() private _moves = 0;
    @state() private _playing = false;

    private _mapping: number[] = [];

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

    private _inChain(i: number): boolean {
        if (this._chain === 0) return false;
        const end = this._startIdx + this._chain;
        if (end <= NUM_BTNS) return this._mapping[i] >= this._startIdx && this._mapping[i] < end;
        return this._mapping[i] >= this._startIdx || this._mapping[i] < end - NUM_BTNS;
    }

    private _generatePuzzle(): void {
        this._mapping = [...Array(NUM_BTNS).keys()].sort(() => Math.random() - 0.5);
        this._chain = 0;
        this._startIdx = -1;
        this._moves = 0;
        this._playing = false;
        this._dispatchStatus();
    }

    private _resetPuzzle(): void {
        this._chain = 0;
        this._startIdx = -1;
        this._moves = 0;
        this._playing = false;
        this._dispatchStatus();
    }

    private _onBtnClick(e: Event): void {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10);
        this._press(idx);
    }

    private _press(idx: number): void {
        if (this._playing) return;
        const lightIdx = this._mapping[idx];
        if (this._chain === 0) {
            this._startIdx = lightIdx;
            this._chain = 1;
            this._moves++;
            playTone(this._chain / NUM_BTNS);
            this._dispatchStatus();
        } else {
            const expected = (this._startIdx + this._chain) % NUM_BTNS;
            if (lightIdx === expected) {
                this._chain++;
                this._moves++;
                playTone(this._chain / NUM_BTNS);
                this._dispatchStatus();
                if (this._chain === NUM_BTNS) this._completePuzzle();
            } else {
                this._startIdx = lightIdx;
                this._chain = 1;
                this._moves++;
                playTone(this._chain / NUM_BTNS);
                this._dispatchStatus();
            }
        }
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._dispatchActions();
        playChime();

        const melodyPromise = playMelody('E4B4G4.E4B4G4.E4B4G4F4E4D4');

        for (let i = 0; i < NUM_BTNS; i++) {
            const light = this.renderRoot.querySelector<HTMLElement>(
                `.safe-light:nth-child(${i + 1})`,
            );
            light?.classList.toggle('chain', i % 2 === 0);
        }

        const interval = setInterval(() => {
            const lights = this.renderRoot.querySelectorAll<HTMLElement>('.safe-light');
            for (const l of lights) l.classList.toggle('chain');
        }, 500);

        await melodyPromise;
        clearInterval(interval);

        for (let i = 0; i < NUM_BTNS; i++) {
            const light = this.renderRoot.querySelector<HTMLElement>(
                `.safe-light:nth-child(${i + 1})`,
            );
            light?.classList.remove('chain');
            await sleep(100);
        }

        this.dispatchEvent(new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }));
    }

    private _dispatchStatus(): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves: this._moves, optimal: NUM_BTNS * 2 - 2 },
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
                          if (!this._playing) this._resetPuzzle();
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
        return html`
            <div id="safe-ring-wrap">
                <div id="safe-ring-inner">
                    ${lightPositions.map(
                        (lp, i) => html`
                            <div
                                class="safe-light ${this._inChain(i) ? 'chain' : ''}"
                                style=${styleMap({ left: lp.left, top: lp.top })}
                            ></div>
                            <div
                                class="safe-arrow"
                                style=${styleMap({
                                    left: arrowPositions[i].left,
                                    top: arrowPositions[i].top,
                                    transform: `rotate(${arrowPositions[i].rotate})`,
                                })}
                            >
                                ⏏
                            </div>
                        `,
                    )}
                    <div id="umbrella-logo" style="width:66%;height:66%">
                        ${unsafeHTML(UMBRELLA_SVG)}
                    </div>
                </div>
            </div>
            <div id="safe-grid">
                ${[0, 1, 2, 3].map(
                    (row) => html`
                        <div class="safe-row">
                            ${[0, 1].map((col) => {
                                const idx = row * 2 + col;
                                const ic = this._inChain(idx);
                                return html` <button
                                    class="safe-btn ${ic ? 'pressed' : ''}"
                                    @click=${this._onBtnClick}
                                    data-idx=${idx}
                                    ?disabled=${ic}
                                >
                                    ${idx + 1}
                                </button>`;
                            })}
                        </div>
                    `,
                )}
            </div>
        `;
    }
}

customElements.define('puzzle-portable-safe', PuzzlePortableSafe);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-portable-safe': PuzzlePortableSafe;
    }
}
