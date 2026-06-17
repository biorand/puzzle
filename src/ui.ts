import type { ActionButton } from './types';

export function createHeader(
  title: string,
  score: number,
  onBack: () => void
): HTMLElement {
  const header = document.createElement('div');
  header.id = 'app-header';
  header.innerHTML = `
    <button id="back-btn">◂ Puzzles</button>
    <span id="puzzle-title">${title}</span>
    <span id="score-display">Score: <span id="score-num">${score}</span></span>
  `;
  header.querySelector('#back-btn')!.addEventListener('click', onBack);
  return header;
}

export function createStatusBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'status-bar';
  bar.innerHTML =
    'Moves: <span id="moves-num">0</span> / Opt: <span id="optimal-num">0</span>';
  return bar;
}

export function createFooter(buttons: ActionButton[]): HTMLElement {
  const foot = document.createElement('div');
  foot.id = 'app-footer';
  for (const btn of buttons) {
    const el = document.createElement('button');
    el.className = 'action-btn';
    el.textContent = btn.label;
    el.addEventListener('click', btn.handler);
    foot.appendChild(el);
  }
  return foot;
}

export function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'complete-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = '<div id="complete-text"></div>';
  return overlay;
}

export interface MenuEntry {
  id: string;
  name: string;
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
    card.textContent = p.name;
    card.dataset.id = p.id;
    card.addEventListener('click', () => onSelect(p.id));
    grid.appendChild(card);
  }
  return menu;
}
