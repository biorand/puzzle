import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { playChime, playTone } from '../audio';
import { sleep, defaultActions } from './shared';
import { PuzzleBase } from './base';
import { Rng } from '../rng';

interface Bottle {
    id: number;
    value: number;
    name: string;
    colorClass: string;
    isPoison: boolean;
}
interface BaseChem {
    name: string;
    value: number;
    colorClass: string;
    label: string;
}
interface Equation {
    leftA: number;
    leftB: number;
    result: number;
}
interface PuzzleConfig {
    bases: [BaseChem, BaseChem, BaseChem];
    equations: Equation[];
    target: number;
    validPairs: string[];
}

const nameCache = new Map<number, string>();

function makeChemicalName(value: number, target: number): string {
    if (value === target) return 'V-JOLT';
    if (value === 1) return 'Water';
    if (value === 3) return 'UMB No.3';
    if (value === 4) return 'NP-004';
    if (value === 6) return 'Yellow-6';
    if (value === 7) return 'UMB No.7';
    if (value === 10) return 'UMB No.10';
    if (value === 17) return 'VP-017';
    const patterns: Array<(v: number) => string> = [
        (v) => `UMB No.${v}`,
        (v) => `NP-${String(v).padStart(3, '0')}`,
        (v) => `Yellow-${v}`,
        (v) => `VP-${String(v).padStart(3, '0')}`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)](value);
}

function getNameForValue(value: number, target: number): string {
    const cached = nameCache.get(value);
    if (cached) return cached;
    const name = makeChemicalName(value, target);
    nameCache.set(value, name);
    return name;
}

function getColorClass(value: number, target: number): string {
    if (value === target) return 'vjolt-brown';
    if (value >= 15) return 'vjolt-darkblue';
    if (value >= 10) return 'vjolt-orange';
    if (value >= 7) return 'vjolt-green';
    if (value >= 4) return 'vjolt-purple';
    return 'vjolt-gray';
}

function pairKey(a: number, b: number): string {
    const [low, high] = a < b ? [a, b] : [b, a];
    return `${low},${high}`;
}

const TEMPLATES: Array<(w: number, r: number, y: number) => [Equation[], number[]]> = [
    (w, r, y) => {
        const d = w + y,
            e = r + y,
            f = d + e,
            g = f + y,
            target = g + r;
        return [
            [
                { leftA: w, leftB: y, result: d },
                { leftA: r, leftB: y, result: e },
                { leftA: d, leftB: e, result: f },
                { leftA: f, leftB: y, result: g },
                { leftA: g, leftB: r, result: target },
            ],
            [d, e, f, g, target],
        ];
    },
    (w, r, y) => {
        const d = w + r,
            e = d + y,
            f = r + y,
            g = e + f,
            target = g + w;
        return [
            [
                { leftA: w, leftB: r, result: d },
                { leftA: d, leftB: y, result: e },
                { leftA: r, leftB: y, result: f },
                { leftA: e, leftB: f, result: g },
                { leftA: g, leftB: w, result: target },
            ],
            [d, e, f, g, target],
        ];
    },
    (w, r, y) => {
        const d = r + y,
            e = w + d,
            f = e + y,
            g = f + r,
            target = g + w;
        return [
            [
                { leftA: r, leftB: y, result: d },
                { leftA: w, leftB: d, result: e },
                { leftA: e, leftB: y, result: f },
                { leftA: f, leftB: r, result: g },
                { leftA: g, leftB: w, result: target },
            ],
            [d, e, f, g, target],
        ];
    },
];

function generatePuzzle(rng: Rng): PuzzleConfig {
    const w = 1;
    const r = rng.nextInteger(2, 4);
    const yMin = Math.max(r + 1, 4);
    const y = rng.nextInteger(yMin, 7);
    const templateIdx = rng.nextInteger(0, TEMPLATES.length - 1);
    const [equations, results] = TEMPLATES[templateIdx](w, r, y);
    const target = results[results.length - 1];
    const baseVals = [w, r, y];
    for (const v of results) {
        if (baseVals.includes(v)) {
            nameCache.clear();
            return generatePuzzle(rng);
        }
    }
    nameCache.clear();
    for (const v of [w, r, y, ...results]) getNameForValue(v, target);
    const bases: [BaseChem, BaseChem, BaseChem] = [
        { name: 'Water', value: w, colorClass: 'vjolt-blue', label: 'Water' },
        { name: nameCache.get(r)!, value: r, colorClass: 'vjolt-red', label: nameCache.get(r)! },
        { name: nameCache.get(y)!, value: y, colorClass: 'vjolt-yellow', label: nameCache.get(y)! },
    ];
    const pairSet = new Set<string>();
    for (const eq of equations) pairSet.add(pairKey(eq.leftA, eq.leftB));
    return { bases, equations, target, validPairs: Array.from(pairSet) };
}

function optimalMoves(): number {
    return 11;
}

export class PuzzleVjolt extends PuzzleBase {
    @state() private _slots: (Bottle | null)[] = [];
    @state() private _selectedIdxs: number[] = [];
    @state() private _moves = 0;
    @state() private _won = false;

    private _config: PuzzleConfig | null = null;
    private _nextId = 1;

    get vanillaCount(): number {
        return 1;
    }

    private _loadVanillaConfig(w: number, r: number, y: number, templateIdx: number): void {
        nameCache.clear();
        const [equations, results] = TEMPLATES[templateIdx](w, r, y);
        const target = results[results.length - 1];
        for (const v of [w, r, y, ...results]) getNameForValue(v, target);
        const bases: [BaseChem, BaseChem, BaseChem] = [
            { name: 'Water', value: w, colorClass: 'vjolt-blue', label: 'Water' },
            {
                name: nameCache.get(r)!,
                value: r,
                colorClass: 'vjolt-red',
                label: nameCache.get(r)!,
            },
            {
                name: nameCache.get(y)!,
                value: y,
                colorClass: 'vjolt-yellow',
                label: nameCache.get(y)!,
            },
        ];
        const pairSet = new Set<string>();
        for (const eq of equations) pairSet.add(pairKey(eq.leftA, eq.leftB));
        this._config = { bases, equations, target, validPairs: Array.from(pairSet) };
        this._resetPuzzle();
    }

    loadVanilla(index: number): void {
        if (index === 0) {
            this._loadVanillaConfig(1, 2, 6, 0);
        }
    }

    _newPuzzle(): void {
        this._config = generatePuzzle(this._getRng());
        this._resetPuzzle();
    }

    private _resetPuzzle(): void {
        this._slots = [null, null, null, null];
        this._nextId = 1;
        this._selectedIdxs = [];
        this._moves = 0;
        this._won = false;
        this._playing = false;
        this._sendStatus(this._moves, optimalMoves());
    }

    private _onShelfClick(e: Event): void {
        const baseIdx = parseInt((e.currentTarget as HTMLElement).dataset.baseidx!, 10);
        this._handleFill(baseIdx);
    }

    private _onBottleClick(e: Event): void {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10);
        this._handleBottleClick(idx);
    }

    private _handleFill(baseIdx: number): void {
        if (this._won || this._playing || !this._config) return;
        const emptyIdx = this._slots.indexOf(null);
        if (emptyIdx === -1) return;
        const base = this._config.bases[baseIdx];
        const next = [...this._slots];
        next[emptyIdx] = {
            id: this._nextId++,
            value: base.value,
            name: getNameForValue(base.value, this._config.target),
            colorClass: base.colorClass,
            isPoison: false,
        };
        this._slots = next;
        this._moves++;
        playTone(0.3);
        this._sendStatus(this._moves, optimalMoves());
    }

    private _handleBottleClick(idx: number): void {
        if (this._won || this._playing) return;
        if (idx >= this._slots.length || this._slots[idx] === null) return;
        const pos = this._selectedIdxs.indexOf(idx);
        const next = [...this._selectedIdxs];
        if (pos >= 0) {
            next.splice(pos, 1);
        } else if (next.length < 2) {
            next.push(idx);
        }
        this._selectedIdxs = next;
    }

    private _handleCombine(): void {
        if (this._won || this._playing || !this._config) return;
        if (this._selectedIdxs.length !== 2) return;
        const [a, b] = this._selectedIdxs;
        const bottleA = this._slots[a];
        const bottleB = this._slots[b];
        if (!bottleA || !bottleB) return;

        const anyPoison = bottleA.isPoison || bottleB.isPoison;
        const sameValue = bottleA.value === bottleB.value;
        const pair = pairKey(bottleA.value, bottleB.value);
        const isValid = !anyPoison && this._config.validPairs.includes(pair);

        this._selectedIdxs = [];
        const next = [...this._slots];

        if (sameValue && !isValid && !anyPoison) {
            next[b] = null;
            this._moves++;
            playTone(0.2);
            this._slots = next;
            this._sendStatus(this._moves, optimalMoves());
            return;
        }

        next[a] = null;
        next[b] = null;

        if (isValid) {
            const newValue = bottleA.value + bottleB.value;
            const emptyIdx = next.indexOf(null);
            next[emptyIdx] = {
                id: this._nextId++,
                value: newValue,
                name: getNameForValue(newValue, this._config.target),
                colorClass: getColorClass(newValue, this._config.target),
                isPoison: false,
            };
            this._moves++;
            playTone(0.5);
            this._slots = next;
            this._sendStatus(this._moves, optimalMoves());
            if (newValue === this._config.target) {
                this._won = true;
                this._triggerWin();
                return;
            }
        } else {
            const emptyIdx = next.indexOf(null);
            next[emptyIdx] = {
                id: this._nextId++,
                value: 0,
                name: '☠ POISON',
                colorClass: 'vjolt-poison',
                isPoison: true,
            };
            this._moves++;
            playTone(0.1);
        }
        this._slots = next;
    }

    private _handleDiscard(): void {
        if (this._won || this._playing) return;
        const idx = this._selectedIdxs.find((i) => this._slots[i] !== null);
        if (idx === undefined) return;
        const nextSlots = [...this._slots];
        nextSlots[idx] = null;
        this._slots = nextSlots;
        this._selectedIdxs = this._selectedIdxs.filter((i) => i !== idx);
        this._moves++;
        playTone(0.15);
        this._sendStatus(this._moves, optimalMoves());
    }

    private async _triggerWin(): Promise<void> {
        if (!this._config) return;
        this._playing = true;
        this._syncActions();

        const targetIdx = this._slots.findIndex(
            (s) => s?.value === this._config!.target && !s.isPoison,
        );
        if (targetIdx >= 0) {
            const el = this.renderRoot.querySelector<HTMLElement>(
                `.vjolt-bottle[data-idx="${targetIdx}"]`,
            );
            el?.classList.add('win');
        }

        await sleep(1000);
        playChime();
        await sleep(400);

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
        if (!this._config) return '';
        return html` <div class="vjolt-wall">
                <div class="vjolt-equations">
                    ${this._config.equations.map(
                        (eq) =>
                            html` <span class="vjolt-equation"
                                >${eq.leftA}+${eq.leftB}=${eq.result}</span
                            >`,
                    )}
                </div>
                <hr class="vjolt-hr" />
                <div class="vjolt-legend">
                    ${this._config.bases.map(
                        (base) =>
                            html` <span class="vjolt-legend-entry ${base.colorClass}"
                                >${base.label}=${base.value}</span
                            >`,
                    )}
                </div>
            </div>
            <div class="vjolt-shelf">
                ${this._config.bases.map(
                    (base, i) =>
                        html` <button
                            class="vjolt-shelf-btn ${base.colorClass}"
                            @click=${this._onShelfClick}
                            data-baseidx=${i}
                            ?disabled=${this._won || this._playing}
                        >
                            <span class="vjolt-shelf-name">${base.label}</span>
                        </button>`,
                )}
            </div>
            <div class="vjolt-workbench">${[0, 1, 2, 3].map((i) => this._renderBottle(i))}</div>
            <div class="vjolt-actions">
                <button
                    class="vjolt-btn vjolt-btn-combine"
                    @click=${this._handleCombine}
                    ?disabled=${this._won ||
                    this._playing ||
                    this._selectedIdxs.filter((i) => this._slots[i] !== null).length !== 2}
                >
                    COMBINE
                </button>
                <button
                    class="vjolt-btn vjolt-btn-discard"
                    @click=${this._handleDiscard}
                    ?disabled=${this._won ||
                    this._playing ||
                    this._selectedIdxs.filter((i) => this._slots[i] !== null).length !== 1}
                >
                    DISCARD
                </button>
            </div>`;
    }

    private _renderBottle(i: number) {
        const b = this._slots[i];
        const isSelected = this._selectedIdxs.includes(i);
        if (!b) {
            return html`<div class="vjolt-bottle empty" data-idx=${i} @click=${this._onBottleClick}>
                <div class="vjolt-bottle-fill"></div>
                <div class="vjolt-bottle-name"></div>
                <div class="vjolt-bottle-value"></div>
            </div>`;
        }
        let cls = `vjolt-bottle ${b.colorClass}`;
        if (isSelected) cls += ' selected';
        if (b.isPoison) cls += ' poison';
        return html`<div class="${cls}" data-idx=${i} @click=${this._onBottleClick}>
            <div class="vjolt-bottle-fill"></div>
            <div class="vjolt-bottle-name">${b.name}</div>
            <div class="vjolt-bottle-value">${b.isPoison ? '' : `#${b.value}`}</div>
        </div>`;
    }
}

customElements.define('puzzle-vjolt', PuzzleVjolt);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-vjolt': PuzzleVjolt;
    }
}
