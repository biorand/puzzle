import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { playMelody, playTone } from '../audio';
import { sleep, defaultActions, UMBRELLA_SVG } from './shared';
import { PuzzleBase } from './base';
import { Rng } from '../rng';

const ROWS = 3;
const COLS = 3;
const SIZE = ROWS * COLS;

const SVG_DATA_URI = `data:image/svg+xml,${encodeURIComponent(UMBRELLA_SVG)}`;

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const GOAL_STR = GOAL.join(',');

function applyShift(board: number[], blank: number, clickPos: number): number[] {
    const next = board.slice();
    const bRow = Math.floor(blank / COLS);
    const bCol = blank % COLS;
    const cRow = Math.floor(clickPos / COLS);
    const cCol = clickPos % COLS;

    if (bRow === cRow) {
        if (cCol < bCol) {
            for (let c = bCol; c > cCol; c--) next[bRow * COLS + c] = next[bRow * COLS + (c - 1)];
        } else {
            for (let c = bCol; c < cCol; c++) next[bRow * COLS + c] = next[bRow * COLS + (c + 1)];
        }
        next[clickPos] = 0;
    } else if (bCol === cCol) {
        if (cRow < bRow) {
            for (let r = bRow; r > cRow; r--) next[r * COLS + bCol] = next[(r - 1) * COLS + bCol];
        } else {
            for (let r = bRow; r < cRow; r++) next[r * COLS + bCol] = next[(r + 1) * COLS + bCol];
        }
        next[clickPos] = 0;
    }
    return next;
}

function isSameRowOrCol(a: number, b: number): boolean {
    return Math.floor(a / COLS) === Math.floor(b / COLS) || a % COLS === b % COLS;
}

function* possibleMoves(board: number[], blank: number): Generator<number[]> {
    const bRow = Math.floor(blank / COLS);
    const bCol = blank % COLS;
    for (let c = 0; c < COLS; c++) {
        if (c === bCol) continue;
        yield applyShift(board, blank, bRow * COLS + c);
    }
    for (let r = 0; r < ROWS; r++) {
        if (r === bRow) continue;
        yield applyShift(board, blank, r * COLS + bCol);
    }
}

function getOptimal(startBoard: number[]): number {
    const startStr = startBoard.join(',');
    if (startStr === GOAL_STR) return 0;
    const dist = new Map<string, number>();
    const q: Array<[number[], number, string]> = [[startBoard, startBoard.indexOf(0), startStr]];
    dist.set(startStr, 0);
    let head = 0;
    while (head < q.length) {
        const [curBoard, blank, curStr] = q[head++];
        const d = dist.get(curStr)!;
        for (const nextBoard of possibleMoves(curBoard, blank)) {
            const nextStr = nextBoard.join(',');
            const nextBlank = nextBoard.indexOf(0);
            if (!dist.has(nextStr)) {
                if (nextStr === GOAL_STR) return d + 1;
                dist.set(nextStr, d + 1);
                q.push([nextBoard, nextBlank, nextStr]);
            }
        }
    }
    return -1;
}

function shufflePuzzle(rng: Rng): { board: number[]; optimal: number } {
    for (;;) {
        const board = [...GOAL];
        let blank = SIZE - 1;
        for (let s = 0; s < 500; s++) {
            const moves = [...possibleMoves(board, blank)];
            const nextBoard = rng.pick(moves);
            for (let i = 0; i < SIZE; i++) board[i] = nextBoard[i];
            blank = board.indexOf(0);
        }
        const optimal = getOptimal(board);
        if (optimal > 0) return { board, optimal };
    }
}

interface TilePos {
    val: number;
    col: number;
    row: number;
}

export class PuzzleSlidingBlock extends PuzzleBase {
    @state() private _board: number[] = [];
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _cellSize = 0;

    private _blankPos = 0;
    private _initialBoard: number[] = [];
    private _resizeObserver: ResizeObserver | null = null;

    disconnectedCallback(): void {
        this._resizeObserver?.disconnect();
        super.disconnectedCallback();
    }

    firstUpdated(): void {
        this._updateCellSize();
        this._resizeObserver = new ResizeObserver(() => this._updateCellSize());
        const wrap = this.renderRoot.querySelector('#sliding-wrap');
        if (wrap) this._resizeObserver.observe(wrap);
    }

    private _updateCellSize(): void {
        const wrap = this.renderRoot.querySelector('#sliding-wrap');
        if (wrap) {
            this._cellSize = wrap.clientWidth / COLS;
        }
    }

    get vanillaCount(): number {
        return 1;
    }

    _newPuzzle(): void {
        const result = shufflePuzzle(this._getRng());
        this._board = result.board;
        this._optimal = result.optimal;
        this._blankPos = this._board.indexOf(0);
        this._moves = 0;
        this._playing = false;
        this._initialBoard = [...this._board];
        this._sendStatus(this._moves, this._optimal);
    }

    private _resetPuzzle(): void {
        this._board = [...this._initialBoard];
        this._blankPos = this._board.indexOf(0);
        this._moves = 0;
        this._playing = false;
        this._sendStatus(this._moves, this._optimal);
    }

    private _onTileClick(e: Event): void {
        if (this._playing) return;
        const val = parseInt((e.currentTarget as HTMLElement).dataset.value!, 10);
        const pos = this._board.indexOf(val);
        if (pos === -1) return;
        if (!isSameRowOrCol(this._blankPos, pos)) return;
        const newBoard = applyShift(this._board, this._blankPos, pos);
        this._blankPos = pos;
        this._board = newBoard;
        this._moves++;
        playTone(val / SIZE);
        this._sendStatus(this._moves, this._optimal);
        if (this._board.join(',') === GOAL_STR) {
            setTimeout(() => this._completePuzzle(), 200);
        }
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._syncActions();

        const melodyPromise = playMelody('G4E5C5D5E5C5G4');
        const tiles = this.renderRoot.querySelectorAll<HTMLElement>('.sliding-tile');
        for (let f = 0; f < 3; f++) {
            for (const el of tiles)
                el.style.filter = f % 2 === 0 ? 'brightness(0.5)' : 'brightness(1)';
            await sleep(180);
        }
        for (const el of tiles) el.style.filter = '';
        await melodyPromise;

        this._sendComplete();
    }

    private _getTiles(): TilePos[] {
        const tiles: TilePos[] = [];
        for (let i = 0; i < SIZE; i++) {
            const val = this._board[i];
            if (val === 0) continue;
            tiles.push({ val, col: i % COLS, row: Math.floor(i / COLS) });
        }
        return tiles;
    }

    private _bgPos(val: number): string {
        const goalCol = (val - 1) % COLS;
        const goalRow = Math.floor((val - 1) / COLS);
        return `${(goalCol / (COLS - 1)) * 100}% ${(goalRow / (ROWS - 1)) * 100}%`;
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

    render() {
        const tiles = this._getTiles();
        return html`
            <div id="sliding-wrap">
                <div id="sliding-grid"></div>
                ${repeat(
                    tiles,
                    (t) => t.val,
                    (t) => {
                        const x = t.col * this._cellSize;
                        const y = t.row * this._cellSize;
                        return html`
                            <div
                                class="sliding-tile"
                                style=${styleMap({
                                    display: this._cellSize > 0 ? 'flex' : 'none',
                                    width: `${this._cellSize}px`,
                                    height: `${this._cellSize}px`,
                                    transform: `translate(${x}px, ${y}px)`,
                                    backgroundImage: `url(${SVG_DATA_URI})`,
                                    backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
                                    backgroundPosition: this._bgPos(t.val),
                                })}
                                data-value=${t.val}
                                @click=${this._onTileClick}
                            ></div>
                        `;
                    },
                )}
            </div>
        `;
    }
}

customElements.define('puzzle-sliding-block', PuzzleSlidingBlock);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-sliding-block': PuzzleSlidingBlock;
    }
}
