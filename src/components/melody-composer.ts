import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import { playMelody } from '../audio';

const PRESETS = [
  { label: 'RE Save Room', value: 'C4/4 E4/4 G4/4 C5/4' },
  {
    label: 'RE Item Fanfare',
    value: 'G4/8 G4/8 E5/8 C5/4 D5/8 E5/8 C5/4 G4/4',
  },
  { label: 'RE Chime', value: 'E5/4 E5/8 D5/8 C5/4' },
  { label: 'Sad / Alone', value: 'A4/4 E4/4 A4/4 C5/4 B4/4 G4/4 A4/2' },
  { label: 'Mystery', value: 'D4/2 G4/4 FS4/4 E4/4 D4/2' },
  {
    label: 'C Major Chord',
    value: 'C4/2.0[0.4]\nE4/2.0[0.4]\nG4/2.0[0.4]',
  },
  {
    label: 'Unlock Fanfare',
    value: 'D5/3.0[0.7]\nZ/0.8 E5/3.0[0.6]\nZ/1.6 F5/5.0[0.5]',
  },
];

export class MelodyComposer extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: Boolean }) playing = false;

  createRenderRoot() {
    return this;
  }

  private _onInput(e: Event): void {
    this.value = (e.target as HTMLTextAreaElement).value;
  }

  private _onPresetClick(e: Event): void {
    const btn = e.currentTarget as HTMLElement;
    this.value = btn.dataset.value ?? '';
  }

  private async _onPlay(): Promise<void> {
    if (!this.value.trim() || this.playing) return;
    this.playing = true;
    await playMelody(this.value);
    this.playing = false;
  }

  private _onClear(): void {
    this.value = '';
  }

  render() {
    return html`
      <div id="melody-wrap">
        <h2 id="melody-title">Melody Composer</h2>

        <textarea
          id="melody-input"
          .value=${this.value}
          @input=${this._onInput}
          placeholder="Type notes like: D5/4 E5/4 G4/4 Z/4 C5/4"
          spellcheck="false"
        ></textarea>

        <div id="melody-hint">
          Format: <code>NoteOctave/Duration</code>, <code>R</code> or <code>Z</code> for rests.
          Duration: <code>/4</code> = quarter, <code>/8</code> = eighth, <code>/1.0</code> = whole,
          <code>/2.0</code> = double. Volume: <code>D5/4[0.6]</code> = 60% volume. Sharps:
          <code>CS5</code> = C♯5, Flats: <code>EB4</code> = E♭4. <strong>Chords:</strong> put each
          voice on its own line, all lines play simultaneously.
        </div>

        <div id="melody-btns">
          <button id="melody-play" ?disabled=${this.playing} @click=${this._onPlay}>
            ${this.playing ? '♫ Playing...' : '▶ Play'}
          </button>
          <button id="melody-clear" @click=${this._onClear}>✕ Clear</button>
        </div>

        <div id="melody-presets-label">Presets:</div>

        <div id="melody-presets">
          ${PRESETS.map(
            (p) => html`
              <button class="melody-preset-btn" data-value=${p.value} @click=${this._onPresetClick}>
                ${p.label}
              </button>
            `,
          )}
        </div>

        <div id="melody-legend">
          <div class="melody-legend-title">Piano Reference (Scientific Pitch Notation)</div>
          <div class="melody-legend-grid">
            <span>C4=262</span> <span>D4=294</span> <span>E4=330</span> <span>F4=349</span>
            <span>G4=392</span> <span>A4=440</span> <span>B4=494</span> <span>C5=523</span>
            <span>D5=587</span> <span>E5=659</span> <span>F5=698</span> <span>G5=784</span>
            <span>A5=880</span> <span>B5=988</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('melody-composer', MelodyComposer);

declare global {
  interface HTMLElementTagNameMap {
    'melody-composer': MelodyComposer;
  }
}
