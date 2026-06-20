import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';

export abstract class PuzzleBase extends LitElement implements PuzzleLitElement {
    createRenderRoot() {
        return this;
    }

    @state() protected _playing = false;

    abstract _newPuzzle(): void;

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener(PUZZLE_REGENERATE, this._regenerateBound);
        this._newPuzzle();
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
