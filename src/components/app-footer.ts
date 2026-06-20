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
        return this.attachShadow({ mode: 'open' });
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
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                :host {
                    display: flex;
                    flex-shrink: 0;
                    background: #1a1a1a;
                    border-top: 1px solid #333;
                    padding: 6px calc(6px + env(safe-area-inset-right, 0px)) 6px
                        calc(6px + env(safe-area-inset-left, 0px));
                }
                button {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    background: none;
                    border: none;
                    color: #888;
                    font-family: inherit;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 2px 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    transition: color 0.15s;
                }
                button:hover {
                    color: #eee;
                }
                button:active {
                    color: #ff6600;
                }
                button:hover .btn-icon {
                    background: rgba(255, 255, 255, 0.1);
                }
                button:disabled {
                    cursor: default;
                    color: transparent;
                }
                button:disabled:hover {
                    color: transparent;
                }
                button:disabled * {
                    display: none;
                }
                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    font-weight: normal;
                    font-style: normal;
                    font-size: 24px;
                    line-height: 1;
                    letter-spacing: normal;
                    text-transform: none;
                    display: inline-block;
                    white-space: nowrap;
                    word-wrap: normal;
                    direction: ltr;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    font-variation-settings:
                        'FILL' 0,
                        'wght' 400,
                        'GRAD' 0,
                        'opsz' 24;
                }
                .btn-icon {
                    font-size: 24px;
                    border-radius: 50%;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s;
                }
                .btn-label {
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 1px;
                    line-height: 1;
                }
            </style>
            ${slots.map(
                (cfg) => html`
                    <button ?disabled=${!cfg.handler} @click=${cfg.handler}>
                        ${cfg.icon
                            ? html`<span class="material-symbols-outlined btn-icon"
                                  >${cfg.icon}</span
                              >`
                            : ''}
                        ${cfg.label ? html`<span class="btn-label">${cfg.label}</span>` : ''}
                    </button>
                `,
            )}
        `;
    }
}

customElements.define('app-footer', AppFooter);

declare global {
    interface HTMLElementTagNameMap {
        'app-footer': AppFooter;
    }
}
