import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

export class CompleteOverlay extends LitElement {
    @property({ type: Boolean }) open = false;
    @property({ type: String }) message = 'COMPLETED';
    @property({ type: String, attribute: 'next-name' }) nextName: string | null = null;

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div id="complete-overlay" class="${this.open ? '' : 'hidden'}">
                <div id="complete-text">${this.message}</div>
                ${this.nextName
                    ? html`
                          <div id="completed-unlock">
                              <div id="completed-unlock-label">PUZZLE UNLOCKED</div>
                              <div id="completed-unlock-name">${this.nextName}</div>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }
}

customElements.define('complete-overlay', CompleteOverlay);

declare global {
    interface HTMLElementTagNameMap {
        'complete-overlay': CompleteOverlay;
    }
}
