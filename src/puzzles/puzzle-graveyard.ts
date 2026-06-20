import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { playChime, playTone } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { flashElements, shuffle, UMBRELLA_SVG } from './shared';

const N = 7;
const STEPS = [3, 4];
const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

const TOTAL_STATES = N * (1 << N);
const bfsDist = new Int16Array(TOTAL_STATES).fill(-1);

function stateIdx(pos: number, mask: number): number {
    return pos * (1 << N) + mask;
}

{
    const q: number[] = [stateIdx(0, 0)];
    bfsDist[stateIdx(0, 0)] = 0;
    let head = 0;
    while (head < q.length) {
        const cur = q[head++];
        const pos = Math.floor(cur / (1 << N));
        const mask = cur % (1 << N);
        const d = bfsDist[cur];
        for (const step of STEPS) {
            const np = (pos + step) % N;
            const nm = mask ^ (1 << np);
            const ni = stateIdx(np, nm);
            if (bfsDist[ni] === -1) {
                bfsDist[ni] = d + 1;
                q.push(ni);
            }
        }
    }
}

const reachableTargets: Array<{ mask: number; optimal: number }> = [];
for (let b1 = 0; b1 < N; b1++) {
    for (let b2 = b1 + 1; b2 < N; b2++) {
        const mask = (1 << b1) | (1 << b2);
        let best = -1;
        for (let p = 0; p < N; p++) {
            const d = bfsDist[stateIdx(p, mask)];
            if (d !== -1 && (best === -1 || d < best)) best = d;
        }
        if (best !== -1) reachableTargets.push({ mask, optimal: best });
    }
}

interface SymbolPos {
    left: string;
    top: string;
    width: string;
    height: string;
    marginLeft: string;
    marginTop: string;
}

export class PuzzleGraveyard extends LitElement implements PuzzleLitElement {
    @state() private _pos = 0;
    @state() private _lights = 0;
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _playing = false;
    @state() private _symbols: string[] = [];
    @state() private _targetMask = 0;
    @state() private _pointerAngle = 0;
    @state() private _symbolPositions: SymbolPos[] = [];
    @state() private _ringSize = 0;
    @state() private _ptrWidth = 5;
    @state() private _ptrLen = 60;
    @state() private _moving = false;
    private _resizeObserver: ResizeObserver | null = null;

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
        this._resizeObserver?.disconnect();
    }

    firstUpdated(): void {
        this._positionDial();
        this._resizeObserver = new ResizeObserver(() => this._positionDial());
        const area = this.renderRoot.querySelector('#graveyard-dial-area');
        if (area) this._resizeObserver.observe(area);
    }

    regenerate(): void {
        this._generatePuzzle();
        this._dispatchActions();
    }

    private _onRegenerate(): void {
        this.regenerate();
    }

    private _positionDial(): void {
        const area = this.renderRoot.querySelector<HTMLElement>('#graveyard-dial-area');
        if (!area) return;
        const parentW = area.clientWidth;
        const parentH = area.clientHeight;
        const S = Math.min(parentW, parentH, 500);
        if (S <= 0) return;

        this._ringSize = S;
        const cx = S / 2,
            cy = S / 2,
            r = S * 0.4;
        const symSize = Math.round(S * 0.17);
        const ptrLen = Math.round(S * 0.37);
        const ptrW = Math.max(Math.round(S * 0.028), 5);

        this._ptrWidth = ptrW;
        this._ptrLen = ptrLen;

        const positions: SymbolPos[] = [];
        for (let i = 0; i < N; i++) {
            const angleDeg = (360 / N) * i - 90;
            const rad = (angleDeg * Math.PI) / 180;
            positions.push({
                left: `${cx + r * Math.cos(rad)}px`,
                top: `${cy + r * Math.sin(rad)}px`,
                width: `${symSize}px`,
                height: `${symSize}px`,
                marginLeft: `${-symSize / 2}px`,
                marginTop: `${-symSize / 2}px`,
            });
        }
        this._symbolPositions = positions;
    }

    private _generatePuzzle(): void {
        this._symbols = shuffle([...ZODIAC]).slice(0, N);
        const r = reachableTargets[Math.floor(Math.random() * reachableTargets.length)];
        this._targetMask = r.mask;
        this._optimal = r.optimal;
        this._pos = 0;
        this._lights = 0;
        this._moves = 0;
        this._playing = false;
        this._moving = false;
        this._pointerAngle = 0;
        this._dispatchStatus();
    }

    private _resetPuzzle(): void {
        this._pos = 0;
        this._lights = 0;
        this._moves = 0;
        this._playing = false;
        this._moving = false;
        this._pointerAngle = 0;
        this._dispatchStatus();
    }

    private _onStepClick(e: Event): void {
        const step = parseInt((e.currentTarget as HTMLElement).dataset.step!, 10);
        this._press(step);
    }

    private _press(step: number): void {
        if (this._playing || this._moving) return;
        this._moving = true;

        this._pos = (this._pos + step) % N;
        this._lights ^= 1 << this._pos;
        this._moves++;
        this._pointerAngle += (step / N) * 360;
        playTone(this._pos / N);

        setTimeout(() => {
            this._moving = false;
            if (this._lights === this._targetMask) this._completePuzzle();
        }, 280);
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._dispatchActions();
        playChime();

        const symbols = this.renderRoot.querySelectorAll<HTMLElement>('.graveyard-symbol');
        await flashElements(Array.from(symbols), 5, 150);

        this.dispatchEvent(new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }));
    }

    private _dispatchStatus(): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves: this._moves, optimal: this._optimal },
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
            <div id="graveyard-layout">
                <div id="graveyard-dial-area">
                    <div
                        id="graveyard-ring-wrap"
                        style=${styleMap({
                            width: this._ringSize > 0 ? `${this._ringSize}px` : '100%',
                            height: this._ringSize > 0 ? `${this._ringSize}px` : '100%',
                        })}
                    >
                        ${this._symbols.map((sym, i) => {
                            const pos = this._symbolPositions[i];
                            if (!pos) return '';
                            const isOn = !!(this._lights & (1 << i));
                            return html` <div
                                class="graveyard-symbol ${isOn ? 'on' : ''}"
                                style=${styleMap({
                                    left: pos.left,
                                    top: pos.top,
                                    width: pos.width,
                                    height: pos.height,
                                    marginLeft: pos.marginLeft,
                                    marginTop: pos.marginTop,
                                })}
                            >
                                ${sym}
                            </div>`;
                        })}
                        <div
                            id="graveyard-pointer"
                            style=${styleMap({
                                borderLeftWidth: `${this._ptrWidth}px`,
                                borderRightWidth: `${this._ptrWidth}px`,
                                borderBottomWidth: `${this._ptrLen}px`,
                                marginLeft: `${-this._ptrWidth}px`,
                                marginTop: `${-this._ptrLen}px`,
                                transform: `rotate(${this._pointerAngle}deg)`,
                            })}
                        ></div>
                        <div
                            id="graveyard-logo"
                            style=${styleMap({
                                width:
                                    this._ringSize > 0
                                        ? `${Math.round(this._ringSize * 0.52)}px`
                                        : '0',
                                height:
                                    this._ringSize > 0
                                        ? `${Math.round(this._ringSize * 0.52)}px`
                                        : '0',
                            })}
                        >
                            ${unsafeHTML(UMBRELLA_SVG)}
                        </div>
                    </div>
                </div>
                <div id="graveyard-goal">
                    <span class="graveyard-goal-label">Goal:</span>
                    ${this._symbols.map((sym, i) => {
                        const isTarget = !!(this._targetMask & (1 << i));
                        return html` <span
                            class="graveyard-goal-symbol ${isTarget ? 'target' : ''}"
                            ?hidden=${!isTarget}
                            >${sym}</span
                        >`;
                    })}
                </div>
                <div id="graveyard-btns">
                    ${STEPS.map(
                        (step) => html`
                            <button
                                class="graveyard-btn"
                                @click=${this._onStepClick}
                                data-step=${step}
                                ?disabled=${this._playing || this._moving}
                            >
                                ${step}
                            </button>
                        `,
                    )}
                </div>
            </div>
        `;
    }
}

customElements.define('puzzle-graveyard', PuzzleGraveyard);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-graveyard': PuzzleGraveyard;
    }
}
