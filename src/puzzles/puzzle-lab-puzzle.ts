import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { playMelody, playTone } from '../audio';
import { sleep } from './shared';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import type { ActionButton, PuzzleLitElement } from '../types';

type Direction = 'up' | 'right' | 'down' | 'left';
type Color = 'blue' | 'green' | 'yellow' | 'red';

interface Cell {
    direction: Direction;
    colorIndex: number;
}

const COLORS: Color[] = ['blue', 'green', 'yellow', 'red'];
const DIR_ORDER: Direction[] = ['up', 'right', 'down', 'left'];
const DIR_INDEX: Record<Direction, number> = { up: 0, right: 1, down: 2, left: 3 };
const ARROW_CHARS: Record<Direction, string> = {
    up: '\u25B2',
    right: '\u25B6',
    down: '\u25BC',
    left: '\u25C0',
};

const DR: Record<Direction, [number, number]> = {
    up: [-1, 0],
    right: [0, 1],
    down: [1, 0],
    left: [0, -1],
};

function rotate(dir: Direction, times: number): Direction {
    return DIR_ORDER[(DIR_INDEX[dir] - times + 4) % 4];
}

function tracePower(grid: Cell[], presses: number[]): Set<number> {
    const visited = new Set<number>();
    let idx = 0;
    while (idx >= 0 && idx < 9 && !visited.has(idx)) {
        visited.add(idx);
        const cell = grid[idx];
        const dir = rotate(cell.direction, presses[cell.colorIndex]);
        const [dr, dc] = DR[dir];
        const r = Math.floor(idx / 3) + dr;
        const c = (idx % 3) + dc;
        if (r < 0 || r > 2 || c < 0 || c > 2) break;
        idx = r * 3 + c;
    }
    return visited;
}

function isSolved(powered: Set<number>, grid: Cell[], presses: number[]): boolean {
    if (!powered.has(8)) return false;
    return rotate(grid[8].direction, presses[grid[8].colorIndex]) === 'down';
}

function solve(grid: Cell[]): number[] | null {
    let best: number[] | null = null;
    let bestTotal = Infinity;
    for (let b = 0; b < 4; b++) {
        for (let g = 0; g < 4; g++) {
            for (let y = 0; y < 4; y++) {
                for (let r = 0; r < 4; r++) {
                    const presses = [b, g, y, r];
                    const total = b + g + y + r;
                    if (total >= bestTotal) continue;
                    if (isSolved(tracePower(grid, presses), grid, presses)) {
                        bestTotal = total;
                        best = presses;
                    }
                }
            }
        }
    }
    return best;
}

export class PuzzleLabPuzzle extends LitElement implements PuzzleLitElement {
    @state() private _grid: Cell[] = [];
    @state() private _colorPresses: number[] = [0, 0, 0, 0];
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _playing = false;
    @state() private _flashState: boolean[] = new Array(9).fill(false);

    private _initialGrid: Cell[] = [];

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
        let solution: number[] | null = null;
        let attempts = 0;
        let grid: Cell[];
        do {
            grid = [];
            for (let i = 0; i < 9; i++) {
                let dir = DIR_ORDER[Math.floor(Math.random() * 4)];
                if (i === 0 && dir === 'down') dir = 'up';
                grid.push({ direction: dir, colorIndex: Math.floor(Math.random() * 4) });
            }
            solution = solve(grid);
            attempts++;
            if (attempts > 10000) break;
        } while (!solution);

        if (!solution) {
            grid = [];
            for (let i = 0; i < 9; i++) grid.push({ direction: 'right', colorIndex: i % 4 });
            solution = solve(grid);
        }

        this._grid = grid;
        this._initialGrid = grid.map((c) => ({ ...c }));
        this._colorPresses = [0, 0, 0, 0];
        this._moves = 0;
        this._optimal = solution ? solution.reduce((a, b) => a + b, 0) : 0;
        this._playing = false;
        this._flashState = new Array(9).fill(false);
        this._dispatchStatus();
    }

    private _resetPuzzle(): void {
        this._grid = this._initialGrid.map((c) => ({ ...c }));
        this._colorPresses = [0, 0, 0, 0];
        this._moves = 0;
        this._playing = false;
        this._flashState = new Array(9).fill(false);
        this._dispatchStatus();
    }

    private _onCellClick(e: Event): void {
        const colorIdx = parseInt((e.currentTarget as HTMLElement).dataset.coloridx!, 10);
        this._pressColor(colorIdx);
    }

    private _pressColor(colorIdx: number): void {
        if (this._playing) return;

        this._colorPresses = this._colorPresses.map((c, i) => (i === colorIdx ? (c + 1) % 4 : c));
        this._moves++;
        playTone(colorIdx / 4);

        // Flash all cells of this color
        const nextFlash = new Array(9).fill(false);
        for (let i = 0; i < 9; i++) {
            if (this._grid[i].colorIndex === colorIdx) nextFlash[i] = true;
        }
        this._flashState = nextFlash;
        setTimeout(() => {
            this._flashState = new Array(9).fill(false);
        }, 500);

        this._dispatchStatus();

        const powered = tracePower(this._grid, this._colorPresses);
        if (isSolved(powered, this._grid, this._colorPresses)) {
            setTimeout(() => this._completePuzzle(), 300);
        }
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._dispatchActions();

        const powered = tracePower(this._grid, this._colorPresses);
        const melodyPromise = playMelody('E4G4A4C5E5D5C5G4');

        for (let f = 0; f < 4; f++) {
            for (let i = 0; i < 9; i++) {
                if (!powered.has(i)) continue;
                const el = this.renderRoot.querySelector<HTMLElement>(
                    `.lab-cell[data-index="${i}"]`,
                );
                if (el) el.style.filter = f % 2 === 0 ? 'brightness(1.5)' : 'brightness(1)';
            }
            await sleep(150);
        }
        for (let i = 0; i < 9; i++) {
            const el = this.renderRoot.querySelector<HTMLElement>(`.lab-cell[data-index="${i}"]`);
            if (el) el.style.filter = '';
        }

        await melodyPromise;

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
        const powered = tracePower(this._grid, this._colorPresses);
        return html` <div id="lab-wrap">
            <div id="lab-note">START → GOAL</div>
            <div id="lab-grid">
                ${this._grid.map((cell, i) => {
                    const effectiveDir = rotate(
                        cell.direction,
                        this._colorPresses[cell.colorIndex],
                    );
                    const colorName = COLORS[cell.colorIndex];
                    const isPow = powered.has(i);
                    const isFlash = this._flashState[i];
                    let cls = `lab-cell lab-${colorName}`;
                    if (isPow) cls += ' lab-powered';
                    if (i === 0) cls += ' lab-start';
                    if (i === 8) cls += ' lab-goal';
                    if (isFlash) cls += ' lab-flash';
                    const flowCls = `lab-flow${isPow ? ` lab-flow-active lab-flow-${effectiveDir}` : ''}`;
                    return html` <div
                        class="${cls}"
                        data-index=${i}
                        data-coloridx=${cell.colorIndex}
                        @click=${this._onCellClick}
                    >
                        <div class="lab-arrow">${ARROW_CHARS[effectiveDir]}</div>
                        <div class="${flowCls}">
                            <span class="lab-flow-arrow">${ARROW_CHARS[effectiveDir]}</span>
                            <span class="lab-flow-arrow">${ARROW_CHARS[effectiveDir]}</span>
                            <span class="lab-flow-arrow">${ARROW_CHARS[effectiveDir]}</span>
                        </div>
                    </div>`;
                })}
            </div>
        </div>`;
    }
}

customElements.define('puzzle-lab-puzzle', PuzzleLabPuzzle);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-lab-puzzle': PuzzleLabPuzzle;
    }
}
