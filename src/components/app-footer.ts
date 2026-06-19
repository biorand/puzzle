import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { ActionButton } from '../types';

interface FooterSlot {
    icon: string;
    label: string;
    handler?: () => void;
}

export class AppFooter extends LitElement {
    @property({ type: Array }) buttons: ActionButton[] = [];

    createRenderRoot() {
        return this;
    }

    render() {
        const slots: FooterSlot[] = [
            { icon: 'add', label: 'New' },
            { icon: '', label: '' },
            { icon: '', label: '' },
            { icon: 'refresh', label: 'Reset' },
        ];

        for (const btn of this.buttons) {
            const lower = btn.label.toLowerCase();
            if (lower.includes('new')) {
                slots[0].handler = btn.handler;
            } else if (lower.includes('reset') || lower.includes('restart')) {
                slots[3].handler = btn.handler;
            }
        }

        return html`
            <div id="app-footer">
                ${slots.map(
                    (cfg) => html`
                        <button
                            class="action-btn ${!cfg.label && !cfg.icon ? 'empty' : ''}"
                            ?disabled=${!cfg.handler}
                            @click=${cfg.handler}
                        >
                            ${cfg.icon
                                ? html`<span class="material-symbols-outlined btn-icon"
                                      >${cfg.icon}</span
                                  >`
                                : ''}
                            ${cfg.label ? html`<span class="btn-label">${cfg.label}</span>` : ''}
                        </button>
                    `,
                )}
            </div>
        `;
    }
}

customElements.define('app-footer', AppFooter);

declare global {
    interface HTMLElementTagNameMap {
        'app-footer': AppFooter;
    }
}
