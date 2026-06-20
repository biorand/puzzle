import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { MenuEntry } from '../types';

export class PuzzleSelect extends LitElement {
    @property({ type: Array }) entries: MenuEntry[] = [];

    createRenderRoot() {
        return this;
    }

    private _onCardClick(e: Event): void {
        const btn = e.currentTarget as HTMLElement;
        const id = btn.dataset.id;
        if (id) this._onSelect(id);
    }

    private _onSelect(id: string): void {
        this.dispatchEvent(
            new CustomEvent('select', { detail: { id }, bubbles: true, composed: true }),
        );
    }

    render() {
        return html`
            <div id="menu">
                <h1><span id="brand-first">Q</span>UICK PLAY</h1>
                <h2>Select a Puzzle</h2>
                <div id="menu-grid">
                    ${this.entries.map(
                        (p) => html`
                            <button
                                class="menu-card ${p.unlocked ? '' : 'locked'}"
                                ?disabled=${!p.unlocked}
                                data-id=${p.id}
                                @click=${this._onCardClick}
                            >
                                <span class="menu-card-thumb">${unsafeHTML(p.thumbnail)}</span>
                                <span class="menu-card-name">${p.name}</span>
                                ${!p.unlocked && p.requirementLabel
                                    ? html`<span class="menu-card-req">${p.requirementLabel}</span>`
                                    : ''}
                            </button>
                        `,
                    )}
                </div>
            </div>
        `;
    }
}

customElements.define('puzzle-select', PuzzleSelect);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-select': PuzzleSelect;
    }
}
