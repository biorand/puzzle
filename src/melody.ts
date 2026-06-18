import { playMelody } from './audio';

const PRESETS = [
  { label: 'RE Save Room', value: 'C4/4 E4/4 G4/4 C5/4' },
  { label: 'RE Item Fanfare', value: 'G4/8 G4/8 E5/8 C5/4 D5/8 E5/8 C5/4 G4/4' },
  { label: 'RE Chime', value: 'E5/4 E5/8 D5/8 C5/4' },
  { label: 'Sad / Alone', value: 'A4/4 E4/4 A4/4 C5/4 B4/4 G4/4 A4/2' },
  { label: 'Mystery', value: 'D4/2 G4/4 FS4/4 E4/4 D4/2' },
  { label: 'C Major Chord', value: 'C4/2.0[0.4]\nE4/2.0[0.4]\nG4/2.0[0.4]' },
  { label: 'Unlock Fanfare', value: 'D5/3.0[0.7]\nZ/0.8 E5/3.0[0.6]\nZ/1.6 F5/5.0[0.5]' },
];

export function createMelodyPage(container: HTMLElement, onBack: () => void): { destroy(): void } {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.id = 'melody-wrap';

  // Title
  const title = document.createElement('h2');
  title.id = 'melody-title';
  title.textContent = 'Melody Composer';
  wrap.appendChild(title);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.id = 'melody-input';
  textarea.placeholder = 'Type notes like: D5/4 E5/4 G4/4 Z/4 C5/4';
  textarea.spellcheck = false;
  wrap.appendChild(textarea);

  // Syntax hint
  const hint = document.createElement('div');
  hint.id = 'melody-hint';
  hint.innerHTML =
    'Format: <code>NoteOctave/Duration</code>, <code>R</code> or <code>Z</code> for rests. ' +
    'Duration: <code>/4</code> = quarter, <code>/8</code> = eighth, <code>/1.0</code> = whole, <code>/2.0</code> = double. ' +
    'Volume: <code>D5/4[0.6]</code> = 60% volume. ' +
    'Sharps: <code>CS5</code> = C♯5, Flats: <code>EB4</code> = E♭4. ' +
    '<strong>Chords:</strong> put each voice on its own line, all lines play simultaneously.';
  wrap.appendChild(hint);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.id = 'melody-btns';

  const playBtn = document.createElement('button');
  playBtn.id = 'melody-play';
  playBtn.textContent = '▶ Play';
  playBtn.addEventListener('click', () => {
    const val = textarea.value.trim();
    if (!val) return;
    playBtn.disabled = true;
    playBtn.textContent = '♫ Playing...';
    playMelody(val).then(() => {
      playBtn.disabled = false;
      playBtn.textContent = '▶ Play';
    });
  });
  btnRow.appendChild(playBtn);

  const clearBtn = document.createElement('button');
  clearBtn.id = 'melody-clear';
  clearBtn.textContent = '✕ Clear';
  clearBtn.addEventListener('click', () => {
    textarea.value = '';
    textarea.focus();
  });
  btnRow.appendChild(clearBtn);

  wrap.appendChild(btnRow);

  // Presets
  const presetsLabel = document.createElement('div');
  presetsLabel.id = 'melody-presets-label';
  presetsLabel.textContent = 'Presets:';
  wrap.appendChild(presetsLabel);

  const presetsRow = document.createElement('div');
  presetsRow.id = 'melody-presets';
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'melody-preset-btn';
    btn.textContent = preset.label;
    btn.title = preset.value;
    btn.addEventListener('click', () => {
      textarea.value = preset.value;
    });
    presetsRow.appendChild(btn);
  }
  wrap.appendChild(presetsRow);

  // Legend / quick reference
  const legend = document.createElement('div');
  legend.id = 'melody-legend';
  legend.innerHTML = `
    <div class="melody-legend-title">Piano Reference (Scientific Pitch Notation)</div>
    <div class="melody-legend-grid">
      <span>C4=262</span> <span>D4=294</span> <span>E4=330</span> <span>F4=349</span>
      <span>G4=392</span> <span>A4=440</span> <span>B4=494</span>
      <span>C5=523</span> <span>D5=587</span> <span>E5=659</span> <span>F5=698</span>
      <span>G5=784</span> <span>A5=880</span> <span>B5=988</span>
    </div>
  `;
  wrap.appendChild(legend);

  container.appendChild(wrap);

  // Auto-focus textarea
  setTimeout(() => textarea.focus(), 100);

  return {
    destroy() {
      container.innerHTML = '';
    },
  };
}
