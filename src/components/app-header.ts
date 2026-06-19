import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

export class AppHeader extends LitElement {
    @property({ type: String }) title = '';
    @property({ type: Boolean, attribute: 'show-back' }) showBack = false;
    @property({ type: Boolean, attribute: 'show-settings' }) showSettings = false;

    createRenderRoot() {
        return this;
    }

    private _onBack(): void {
        this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
    }

    private _onSettings(): void {
        this.dispatchEvent(new CustomEvent('settings', { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <div id="app-header">
                <button
                    id="back-btn"
                    ?hidden=${!this.showBack}
                    aria-label="Back"
                    @click=${this._onBack}
                >
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <span id="puzzle-title">${this.title}</span>
                <button
                    id="settings-btn"
                    ?hidden=${!this.showSettings}
                    aria-label="Settings"
                    @click=${this._onSettings}
                >
                    <span class="material-symbols-outlined">settings</span>
                </button>
            </div>
        `;
    }
}

customElements.define('app-header', AppHeader);

declare global {
    interface HTMLElementTagNameMap {
        'app-header': AppHeader;
    }
}
