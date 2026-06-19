import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

export class StatusBar extends LitElement {
    @property({ type: Number }) moves = 0;
    @property({ type: Number }) optimal = 0;
    @property({ type: Number }) score = 0;

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div id="status-bar">
                Moves: <span id="moves-num">${this.moves}</span> / Opt:
                <span id="optimal-num">${this.optimal}</span>
                &nbsp;
                <span id="score-label">Score: <span id="score-num">${this.score}</span></span>
            </div>
        `;
    }
}

customElements.define('status-bar', StatusBar);

declare global {
    interface HTMLElementTagNameMap {
        'status-bar': StatusBar;
    }
}
