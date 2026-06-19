import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';

const SOUND_KEY = 'repuzzles-sound-enabled';

export class SettingsPage extends LitElement {
    @state() private _soundEnabled: boolean = localStorage.getItem(SOUND_KEY) !== 'false';
    @state() private _confirmReset = false;

    createRenderRoot() {
        return this;
    }

    private _onSoundToggle(e: Event): void {
        const val = (e.target as HTMLInputElement).checked;
        this._soundEnabled = val;
        localStorage.setItem(SOUND_KEY, String(val));
    }

    private _onResetClick(): void {
        if (!this._confirmReset) {
            this._confirmReset = true;
            return;
        }
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('repuzzles-'));
        for (const k of keys) localStorage.removeItem(k);
        this.dispatchEvent(new CustomEvent('reset', { bubbles: true, composed: true }));
    }

    private _onCancelReset(): void {
        this._confirmReset = false;
    }

    render() {
        return html`
            <div id="settings-wrap">
                <!-- About -->
                <div class="settings-section">
                    <div class="settings-section-title">About</div>
                    <div id="settings-about">
                        <div id="settings-about-name">BioRand Puzzles</div>
                        <div id="settings-about-credit">by IntelOrca</div>
                        <div id="settings-about-desc">A Resident Evil puzzle collection</div>
                    </div>
                </div>

                <!-- Audio -->
                <div class="settings-section">
                    <div class="settings-section-title">Audio</div>
                    <label class="settings-toggle">
                        <input
                            type="checkbox"
                            ?checked=${this._soundEnabled}
                            @change=${this._onSoundToggle}
                        />
                        <span class="settings-toggle-slider"></span>
                        <span class="settings-toggle-label">Sound Effects</span>
                    </label>
                </div>

                <!-- Data & Progress -->
                <div class="settings-section">
                    <div class="settings-section-title">Data & Progress</div>
                    <div class="settings-warning">
                        <span class="material-symbols-outlined settings-warning-icon">warning</span>
                        <span
                            >This will erase all scores, unlock progress, and tutorial progress. All
                            puzzles will be locked again. This action cannot be undone.</span
                        >
                    </div>
                    <button
                        id="settings-reset-btn"
                        class="${this._confirmReset ? 'confirm' : ''}"
                        @click=${this._onResetClick}
                    >
                        ${this._confirmReset ? 'Confirm — Reset Everything' : 'Reset All Data'}
                    </button>
                    ${this._confirmReset
                        ? html`
                              <button id="settings-cancel-btn" @click=${this._onCancelReset}>
                                  Cancel
                              </button>
                          `
                        : ''}
                </div>
            </div>
        `;
    }
}

customElements.define('settings-page', SettingsPage);

declare global {
    interface HTMLElementTagNameMap {
        'settings-page': SettingsPage;
    }
}
