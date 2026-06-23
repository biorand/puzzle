import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { playChime, playTone } from '../audio';
import { sleep, defaultActions } from './shared';
import { PuzzleBase } from './base';
import { Rng } from '../rng';

type Action = 'red' | 'blue' | 'green';
interface Plant43State {
    fills: [number, number, number];
    slots: [number, number, number];
}
interface BfsEntry {
    state: Plant43State;
    moves: number;
    path: Action[];
}
interface PuzzleConfig {
    targetFill: number;
    optimalMoves: number;
    solution: Action[];
    startState: Plant43State;
}

const CAPACITIES: [number, number, number] = [7, 5, 3];
const START_SLOTS: [number, number, number] = [1, 0, 2];
const START_FILLS: [number, number, number] = [7, 0, 0];
const MAX_MOVES = 20;
const MAX_TUBE_HEIGHT = 160;
const GLASS_BOTTOM_Y = 26;
const POUR_DURATION = 525;
const DRAIN_DURATION = 2400;

const TUBE_HEIGHTS = CAPACITIES.map((c) => Math.round((c / CAPACITIES[0]) * MAX_TUBE_HEIGHT));
const SLOT_LEFT = [0, 33.33, 66.67];

function cloneState(s: Plant43State): Plant43State {
    return {
        fills: [...s.fills] as [number, number, number],
        slots: [...s.slots] as [number, number, number],
    };
}

function stateKey(s: Plant43State): string {
    return `${s.slots[0]},${s.slots[1]},${s.slots[2]}|${s.fills[0]},${s.fills[1]},${s.fills[2]}`;
}

function apply(state: Plant43State, action: Action): Plant43State | null {
    const next = cloneState(state);
    switch (action) {
        case 'red':
            [next.slots[0], next.slots[1]] = [next.slots[1], next.slots[0]];
            break;
        case 'blue':
            [next.slots[1], next.slots[2]] = [next.slots[2], next.slots[1]];
            break;
        case 'green': {
            const leftTube = next.slots[0];
            const midTube = next.slots[1];
            const pourAmt = Math.min(
                next.fills[midTube],
                Math.max(0, CAPACITIES[leftTube] - next.fills[leftTube]),
            );
            if (pourAmt === 0) return null;
            next.fills[leftTube] += pourAmt;
            next.fills[midTube] -= pourAmt;
            break;
        }
    }
    return next;
}

function isWin(state: Plant43State, targetFill: number): boolean {
    return state.fills[state.slots[0]] === targetFill;
}

function bfsAll(start?: Plant43State): Map<string, BfsEntry> {
    const s = start || { fills: [...START_FILLS], slots: [...START_SLOTS] };
    const visited = new Map<string, BfsEntry>();
    const queue: BfsEntry[] = [];
    const k = stateKey(s);
    visited.set(k, { state: s, moves: 0, path: [] });
    queue.push({ state: s, moves: 0, path: [] });
    while (queue.length > 0) {
        const entry = queue.shift()!;
        if (entry.moves >= MAX_MOVES) continue;
        for (const action of ['red', 'blue', 'green'] as Action[]) {
            const next = apply(entry.state, action);
            if (!next) continue;
            const nk = stateKey(next);
            if (!visited.has(nk)) {
                const newPath = [...entry.path, action];
                visited.set(nk, { state: next, moves: entry.moves + 1, path: newPath });
                queue.push({ state: next, moves: entry.moves + 1, path: newPath });
            }
        }
    }
    return visited;
}

function generateRandomStart(rng: Rng, total: number): Plant43State {
    for (;;) {
        const a = rng.nextInteger(0, Math.min(total, CAPACITIES[0]));
        const rem = total - a;
        if (rem > CAPACITIES[1] + CAPACITIES[2]) continue;
        const b = rng.nextInteger(0, Math.min(rem, CAPACITIES[1]));
        const c = rem - b;
        if (c >= 0 && c <= CAPACITIES[2]) return { fills: [a, b, c], slots: [...START_SLOTS] };
    }
}

function generatePuzzle(rng: Rng): PuzzleConfig {
    for (let attempt = 0; attempt < 200; attempt++) {
        const total = rng.nextInteger(4, 12);
        const startState = generateRandomStart(rng, total);
        const reachable = bfsAll(startState);
        const bestPerFill = new Map<number, BfsEntry>();
        for (const entry of reachable.values()) {
            const f = entry.state.fills[entry.state.slots[0]];
            if (f <= 0 || f >= 7 || CAPACITIES.includes(f)) continue;
            const best = bestPerFill.get(f);
            if (!best || entry.moves < best.moves) bestPerFill.set(f, entry);
        }
        const validFills = Array.from(bestPerFill.entries()).filter(
            ([, v]) => v.moves >= 4 && v.moves <= MAX_MOVES,
        );
        if (validFills.length > 0) {
            const chosen = validFills[rng.nextInteger(0, validFills.length - 1)];
            return {
                targetFill: chosen[0],
                optimalMoves: chosen[1].moves,
                solution: chosen[1].path,
                startState,
            };
        }
    }
    const fallback = bfsAll();
    const bestPerFill = new Map<number, BfsEntry>();
    for (const entry of fallback.values()) {
        const f = entry.state.fills[entry.state.slots[0]];
        if (f <= 0 || f >= 7 || CAPACITIES.includes(f)) continue;
        const best = bestPerFill.get(f);
        if (!best || entry.moves < best.moves) bestPerFill.set(f, entry);
    }
    const validFills = Array.from(bestPerFill.entries()).filter(
        ([, v]) => v.moves >= 4 && v.moves <= MAX_MOVES,
    );
    const chosen = validFills[0];
    return {
        targetFill: chosen[0],
        optimalMoves: chosen[1].moves,
        solution: chosen[1].path,
        startState: { fills: [...START_FILLS], slots: [...START_SLOTS] },
    };
}

const ICONS: Record<string, string> = {
    green: 'arrow_downward',
    red: 'swap_horiz',
    blue: 'sync_alt',
};

export class PuzzlePlant43 extends PuzzleBase {
    @state() private _currentState: Plant43State | null = null;
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _won = false;
    @state() private _animating = false;

    private _puzzleConfig: PuzzleConfig | null = null;

    get vanillaCount(): number {
        return 2;
    }

    _newPuzzle(): void {
        this._puzzleConfig = generatePuzzle(this._getRng());
        const s = this._puzzleConfig.startState;
        this._currentState = { fills: [...s.fills], slots: [...s.slots] };
        this._moves = 0;
        this._optimal = this._puzzleConfig.optimalMoves;
        this._won = false;
        this._animating = false;
        this._playing = false;
        this._sendStatus(this._moves, this._optimal);
        // Reset fill bar transitions after re-render
        requestAnimationFrame(() => {
            const bars = this.renderRoot.querySelectorAll<HTMLElement>('.plant43-tube-fill');
            for (const bar of bars) bar.style.transition = `height ${POUR_DURATION}ms ease`;
        });
    }

    private _resetPuzzle(): void {
        if (!this._puzzleConfig) return;
        const s = this._puzzleConfig.startState;
        this._currentState = { fills: [...s.fills], slots: [...s.slots] };
        this._moves = 0;
        this._won = false;
        this._animating = false;
        this._playing = false;
        this._sendStatus(this._moves, this._optimal);
        requestAnimationFrame(() => {
            const bars = this.renderRoot.querySelectorAll<HTMLElement>('.plant43-tube-fill');
            for (const bar of bars) bar.style.transition = `height ${POUR_DURATION}ms ease`;
        });
    }

    private _onActionClick(e: Event): void {
        const action = (e.currentTarget as HTMLElement).dataset.action as Action;
        this._handleAction(action);
    }

    private async _handleAction(action: Action): Promise<void> {
        if (this._won || this._animating || !this._currentState || !this._puzzleConfig) return;
        const next = apply(this._currentState, action);
        if (!next) return;

        this._animating = true;
        this._currentState = next;
        this._moves++;
        this._sendStatus(this._moves, this._optimal);

        const delay = action === 'green' ? POUR_DURATION + 50 : 370;

        if (isWin(this._currentState, this._puzzleConfig.targetFill)) {
            this._won = true;
            await sleep(delay);
            this._animating = false;
            await this._drainAnimation();
        } else {
            await sleep(delay);
            this._animating = false;
        }
    }

    private async _drainAnimation(): Promise<void> {
        if (!this._currentState || !this._puzzleConfig) return;

        this._playing = true;
        this._syncActions();

        // Wait for any pending Lit updates (from _animating change) to flush
        await this.updateComplete;

        const bar = this.renderRoot.querySelector<HTMLElement>(
            `.plant43-tube[data-slot="0"] .plant43-tube-fill`,
        );
        if (bar) {
            bar.style.transition = `height ${DRAIN_DURATION}ms ease-in`;
            // Force reflow so the browser sees the transition before height change
            void bar.offsetHeight;
            bar.style.height = '0%';
        }

        const drainTones = [0.5, 0.42, 0.35, 0.28, 0.2];
        const toneInterval = DRAIN_DURATION / drainTones.length;
        for (let ti = 0; ti < drainTones.length; ti++) {
            setTimeout(() => playTone(drainTones[ti]), ti * toneInterval);
        }

        await sleep(DRAIN_DURATION + 200);
        playChime();

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

    render() {
        const state = this._currentState;
        return html` <div class="plant43-stage">
                <div
                    class="plant43-target-line"
                    style=${styleMap(this._getTargetLineStyle(state))}
                ></div>
                ${[0, 1, 2].map((tubeId) => this._renderTube(tubeId, state))}
            </div>
            <div class="plant43-buttons">
                ${(['green', 'red', 'blue'] as Action[]).map(
                    (action) => html`
                        <button
                            class="plant43-btn btn-${action}"
                            data-action=${action}
                            @click=${this._onActionClick}
                            ?disabled=${this._won || this._animating || !state}
                        >
                            <span class="material-symbols-outlined">${ICONS[action]}</span>
                        </button>
                    `,
                )}
            </div>`;
    }

    private _getTargetLineStyle(state: Plant43State | null) {
        if (!state || !this._puzzleConfig) return { display: 'none' };
        const leftTube = state.slots[0];
        const leftCap = CAPACITIES[leftTube];
        const leftGlassH = TUBE_HEIGHTS[leftTube];
        const lineBottom = GLASS_BOTTOM_Y + (this._puzzleConfig.targetFill / leftCap) * leftGlassH;
        return { bottom: `${lineBottom}px` };
    }

    private _renderTube(tubeId: number, state: Plant43State | null) {
        if (!state) return '';
        const { slots, fills } = state;
        const slotIdx = slots.indexOf(tubeId);
        const fill = fills[tubeId];
        const cap = CAPACITIES[tubeId];
        const glassH = TUBE_HEIGHTS[tubeId];
        const fillArea = glassH - 4;
        const pct = (((fill / cap) * fillArea) / glassH) * 100;
        return html` <div
            class="plant43-tube"
            style=${styleMap({ left: `${SLOT_LEFT[slotIdx]}%` })}
            data-slot=${slotIdx}
        >
            <div class="plant43-tube-glass" style=${styleMap({ height: `${glassH}px` })}>
                <div class="plant43-tube-fill" style=${styleMap({ height: `${pct}%` })}></div>
                <div class="plant43-tube-markers">
                    ${Array.from({ length: cap - 1 }, (_, i) => i + 1).map(
                        (v) =>
                            html` <div
                                class="plant43-tube-marker"
                                style=${styleMap({ bottom: `${(v / cap) * 100}%` })}
                            >
                                <div class="plant43-tube-marker-line"></div>
                                <span class="plant43-tube-marker-label">${v}</span>
                            </div>`,
                    )}
                </div>
            </div>
        </div>`;
    }
}

customElements.define('puzzle-plant43', PuzzlePlant43);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-plant43': PuzzlePlant43;
    }
}
