import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { playChime, playMelody, playTone } from '../audio';
import { sleep } from './shared';
import { defaultActions } from './shared';
import { PuzzleBase } from './base';

const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
const SOLVED = 0x1ff;

const dist = new Int8Array(512).fill(-1);
const groups: number[][] = Array.from({ length: 5 }, () => []);
let maxDist = 0;

{
    const q = [SOLVED];
    dist[SOLVED] = 0;
    groups[0].push(SOLVED);
    for (let i = 0; i < q.length; i++) {
        const cur = q[i];
        const nd = dist[cur] + 1;
        if (nd > maxDist) maxDist = nd;
        for (const mask of MASKS) {
            const next = cur ^ mask;
            if (dist[next] !== -1) continue;
            dist[next] = nd;
            q.push(next);
            if (nd < groups.length) groups[nd].push(next);
        }
    }
}

export class PuzzleKeypad extends PuzzleBase {
    @state() private _state = SOLVED;
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _cellVisible = new Array(9).fill(true);

    @property({ type: Number }) tutorialStep?: number;
    @property({ type: Number }) tutorialTotal = 5;
    @property({ type: Number }) forceDifficulty?: number;

    private _initialState = SOLVED;
    private _cheatBuffer: number[] = [];
    private _cheatCount = 0;

    _newPuzzle(): void {
        let d: number;
        if (
            this.forceDifficulty !== undefined &&
            this.forceDifficulty >= 1 &&
            this.forceDifficulty <= maxDist
        ) {
            d = this.forceDifficulty;
        } else {
            d = Math.floor(Math.random() * Math.min(4, maxDist)) + 1;
        }
        const pool = groups[d];
        const pick = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : SOLVED;
        this._initialState = pick;
        this._state = pick;
        this._moves = 0;
        this._optimal = d;
        this._playing = false;
        this._cellVisible = new Array(9).fill(true);
        this._cheatBuffer = [];
        this._sendStatus(this._moves, this._optimal);
    }

    private _resetPuzzle(): void {
        this._state = this._initialState;
        this._moves = 0;
        this._playing = false;
        this._sendStatus(this._moves, this._optimal);
    }

    private _press(idx: number): void {
        if (this._playing) return;

        const checkBuffer = [...this._cheatBuffer, idx + 1].slice(-4);
        const isCheatMatch =
            checkBuffer.length === 4 &&
            checkBuffer[0] === 2 &&
            checkBuffer[1] === 2 &&
            checkBuffer[2] === 3 &&
            checkBuffer[3] === 6;

        this._state ^= MASKS[idx];
        this._moves++;

        if (!isCheatMatch) playTone(idx / 8);
        this._sendStatus(this._moves, this._optimal);

        if (this._state === SOLVED) {
            this._completePuzzle();
        }

        this._cheatBuffer.push(idx + 1);
        if (this._cheatBuffer.length > 4) this._cheatBuffer.shift();

        if (isCheatMatch) {
            this._cheatCount++;
            if (this._cheatCount === 1) {
                playMelody('D5');
            } else if (this._cheatCount === 2) {
                playMelody('E5');
            } else if (this._cheatCount >= 3) {
                this._cheatCount = 3;
                this.dispatchEvent(
                    new CustomEvent('cheat-unlock-all', {
                        detail: {
                            playMelodyFn: playMelody(
                                'D5/3.0[0.3]\nZ/0.8 E5/3.0[0.2.5]\nZ/1.6 F5/5.0[0.2]',
                            ),
                        },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        }
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._syncActions();
        playChime();

        // State-driven animation: hide cells one by one via Lit re-renders
        for (let i = 8; i >= 0; i--) {
            await sleep(120);
            const next = [...this._cellVisible];
            next[i] = false;
            this._cellVisible = next;
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

    private _onCellClick(e: Event): void {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10);
        this._press(idx);
    }

    render() {
        return html`
            <div id="keypad">
                ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(
                    (i) => html`
                        <button
                            class="cell ${this._state & (1 << i) && this._cellVisible[i]
                                ? 'orange'
                                : ''}"
                            @click=${this._onCellClick}
                            data-idx=${i}
                            ?disabled=${this._playing}
                        >
                            ${i + 1}
                        </button>
                    `,
                )}
            </div>
            ${this.tutorialStep !== undefined
                ? html`
                      <div id="keypad-tutorial">
                          Tutorial ${this.tutorialStep + 1}/${this.tutorialTotal} — Solve in
                          ${this._optimal} move${this._optimal !== 1 ? 's' : ''}
                      </div>
                  `
                : ''}
        `;
    }
}

customElements.define('puzzle-keypad', PuzzleKeypad);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-keypad': PuzzleKeypad;
    }
}
