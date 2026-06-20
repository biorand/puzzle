import { LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { Rng } from '../rng';

export abstract class PuzzleBase extends LitElement implements PuzzleLitElement {
    createRenderRoot() {
        return this;
    }

    @property({ type: Object }) rng?: Rng;

    @property({ type: Number }) vanillaIndex = -1;

    @state() protected _playing = false;

    abstract _newPuzzle(): void;

    get vanillaCount(): number {
        return 0;
    }

    loadVanilla(_index: number): void {
        this._newPuzzle();
    }

    loadSeed(seed: number): void {
        this.rng = new Rng(seed);
        this._newPuzzle();
    }

    protected _getRng(): Rng {
        return this.rng ?? new Rng();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener(PUZZLE_REGENERATE, this._regenerateBound);
        if (this.vanillaIndex >= 0) {
            this.loadVanilla(this.vanillaIndex);
        } else {
            this._newPuzzle();
        }
        this._syncActions();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener(PUZZLE_REGENERATE, this._regenerateBound);
    }

    private _regenerateBound: EventListener = () => {
        this._newPuzzle();
        this._syncActions();
    };

    regenerate(): void {
        this._newPuzzle();
        this._syncActions();
    }

    protected _sendStatus(moves: number, optimal: number): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves, optimal },
                bubbles: true,
                composed: true,
            }),
        );
    }

    protected _sendActions(buttons: ActionButton[]): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_ACTIONS, {
                detail: buttons,
                bubbles: true,
                composed: true,
            }),
        );
    }

    protected _sendComplete(): void {
        this.dispatchEvent(new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }));
    }

    protected abstract _syncActions(): void;
}
