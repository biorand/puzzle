import type { ActionButton } from './types';

export function createHeader(
  title: string,
  onBack: () => void
): HTMLElement {
  const header = document.createElement('div');
  header.id = 'app-header';
  header.innerHTML = `
    <button id="back-btn" aria-label="Back"><span class="material-symbols-outlined">arrow_back</span></button>
    <span id="puzzle-title">${title}</span>
    <button id="settings-btn" aria-label="Settings"><span class="material-symbols-outlined">settings</span></button>
  `;
  header.querySelector('#back-btn')!.addEventListener('click', onBack);
  header.querySelector('#settings-btn')!.addEventListener('click', () => {
    // Settings — not yet implemented
  });
  return header;
}

export function createStatusBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'status-bar';
  bar.innerHTML =
    'Moves: <span id="moves-num">0</span> / Opt: <span id="optimal-num">0</span> &nbsp; <span id="score-label">Score: <span id="score-num">0</span></span>';
  return bar;
}

export function createFooter(buttons: ActionButton[]): HTMLElement {
  const foot = document.createElement('div');
  foot.id = 'app-footer';

  // 4 fixed slots: [New, slot2, slot3, Reset]
  const slots: Array<{ icon: string; label: string; handler?: () => void }> = [
    { icon: 'add', label: 'New' },
    { icon: '', label: '' },
    { icon: '', label: '' },
    { icon: 'refresh', label: 'Reset' },
  ];

  for (const btn of buttons) {
    const lower = btn.label.toLowerCase();
    if (lower.includes('new')) {
      slots[0].handler = btn.handler;
    } else if (lower.includes('reset') || lower.includes('restart')) {
      slots[3].handler = btn.handler;
    }
  }

  for (const cfg of slots) {
    const el = document.createElement('button');
    el.className = 'action-btn';
    if (!cfg.label && !cfg.icon) {
      el.classList.add('empty');
    }
    if (cfg.handler) {
      el.addEventListener('click', cfg.handler);
    }
    if (cfg.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined btn-icon';
      iconSpan.textContent = cfg.icon;
      el.appendChild(iconSpan);
    }
    if (cfg.label) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'btn-label';
      labelSpan.textContent = cfg.label;
      el.appendChild(labelSpan);
    }
    foot.appendChild(el);
  }

  return foot;
}

export function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'complete-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div id="complete-text"></div>
    <div id="completed-unlock" style="display:none">
      <div id="completed-unlock-label">PUZZLE UNLOCKED</div>
      <div id="completed-unlock-name"></div>
    </div>
  `;
  return overlay;
}

export interface MenuEntry {
  id: string;
  name: string;
  unlocked: boolean;
  requirementLabel?: string;
}

export function createMenu(
  puzzles: MenuEntry[],
  onSelect: (id: string) => void
): HTMLElement {
  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.innerHTML = `
    <h1>RESIDENT EVIL</h1>
    <h2>Puzzle Collection</h2>
    <div id="menu-grid"></div>
  `;
  const grid = menu.querySelector('#menu-grid')!;
  for (const p of puzzles) {
    const card = document.createElement('button');
    card.className = 'menu-card';
    if (!p.unlocked) {
      card.classList.add('locked');
      card.disabled = true;
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'menu-card-name';
    nameSpan.textContent = p.name;
    card.appendChild(nameSpan);
    if (!p.unlocked && p.requirementLabel) {
      const reqSpan = document.createElement('span');
      reqSpan.className = 'menu-card-req';
      reqSpan.textContent = p.requirementLabel;
      card.appendChild(reqSpan);
    }
    card.dataset.id = p.id;
    if (p.unlocked) {
      card.addEventListener('click', () => onSelect(p.id));
    }
    grid.appendChild(card);
  }
  return menu;
}
