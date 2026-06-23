import { LitElement, html } from 'lit';

export class PuzzleMenu extends LitElement {
    createRenderRoot() {
        return this;
    }

    private _onVanillaRun(): void {
        this.dispatchEvent(new CustomEvent('vanilla-run', { bubbles: true, composed: true }));
    }

    private _onRandomRun(): void {
        this.dispatchEvent(new CustomEvent('random-run', { bubbles: true, composed: true }));
    }

    private _onQuickPlay(): void {
        this.dispatchEvent(new CustomEvent('quick-play', { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <div id="menu">
                <h1><span id="brand-first">B</span>IORAND</h1>
                <h2>Puzzle Collection</h2>
                <div id="menu-run-btns">
                    <button class="menu-run-btn" @click=${this._onRandomRun}>
                        <span class="menu-run-btn-icon">🎲</span>
                        <span class="menu-run-btn-label">New Run</span>
                    </button>
                    <button class="menu-run-btn" @click=${this._onVanillaRun}>
                        <span class="menu-run-btn-icon">📖</span>
                        <span class="menu-run-btn-label">Vanilla Run</span>
                    </button>
                    <button class="menu-run-btn" @click=${this._onQuickPlay}>
                        <span class="menu-run-btn-icon">🎮</span>
                        <span class="menu-run-btn-label">Quick Play</span>
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('puzzle-menu', PuzzleMenu);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-menu': PuzzleMenu;
    }
}
