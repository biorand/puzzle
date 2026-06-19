import { afterEach, describe, expect, it, vi } from 'vitest';
import { labPuzzle } from '../../src/puzzles/labPuzzle';
import type { PuzzleContext } from '../../src/types';

const ARROW_ORDER = ['↑', '→', '↓', '←'];

function createMockContext(): PuzzleContext {
  return {
    setStatus: vi.fn(),
    setActions: vi.fn(),
    showOverlay: vi.fn().mockResolvedValue(undefined),
    hideOverlay: vi.fn(),
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    score: { count: 0, increment: vi.fn().mockReturnValue(null) },
  };
}

describe('labPuzzle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates 9 cells and 4 color buttons', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    expect(cells.length).toBe(9);

    for (let i = 0; i < 9; i++) {
      const arrow = cells[i].querySelector('.lab-arrow');
      expect(arrow).not.toBeNull();
      expect(ARROW_ORDER).toContain(arrow!.textContent);
    }

    const btns = container.querySelectorAll('.lab-btn');
    expect(btns.length).toBe(4);

    const btnColors = ['red', 'blue', 'yellow', 'green'];
    for (const color of btnColors) {
      expect(container.querySelector(`.lab-btn-${color}`)).not.toBeNull();
    }

    instance.destroy();
  });

  it('calls setStatus after creation with moves: 0', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ moves: 0 }),
    );

    instance.destroy();
  });

  it('sets actions on creation', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    expect(ctx.setActions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'New Puzzle' }),
        expect.objectContaining({ label: 'Reset' }),
      ]),
    );

    instance.destroy();
  });

  it('pressing a color button increments moves', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    vi.mocked(ctx.setStatus).mockClear();

    container.querySelector<HTMLElement>('.lab-btn-red')!.click();
    expect(ctx.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ moves: 1 }),
    );

    instance.destroy();
  });

  it('clicking different color buttons increments moves each time', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    vi.mocked(ctx.setStatus).mockClear();

    container.querySelector<HTMLElement>('.lab-btn-blue')!.click();
    container.querySelector<HTMLElement>('.lab-btn-yellow')!.click();
    container.querySelector<HTMLElement>('.lab-btn-green')!.click();

    expect(ctx.setStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ moves: 3 }),
    );

    instance.destroy();
  });

  it('pressing a color button rotates red arrows 90° clockwise', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const redIndices: number[] = [];
    const otherIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains('lab-red')) redIndices.push(i);
      else otherIndices.push(i);
    });

    expect(redIndices.length).toBeGreaterThan(0);

    container.querySelector<HTMLElement>('.lab-btn-red')!.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (const i of redIndices) {
      const expectedIdx = (ARROW_ORDER.indexOf(arrowsBefore[i]) + 1) % 4;
      expect(arrowsAfter[i]).toBe(ARROW_ORDER[expectedIdx]);
    }

    for (const i of otherIndices) {
      expect(arrowsAfter[i]).toBe(arrowsBefore[i]);
    }

    instance.destroy();
  });

  it('pressing a color button twice rotates arrows 180°', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const redIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains('lab-red')) redIndices.push(i);
    });

    const btn = container.querySelector<HTMLElement>('.lab-btn-red')!;
    btn.click();
    btn.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (const i of redIndices) {
      const expectedIdx = (ARROW_ORDER.indexOf(arrowsBefore[i]) + 2) % 4;
      expect(arrowsAfter[i]).toBe(ARROW_ORDER[expectedIdx]);
    }

    instance.destroy();
  });

  it('pressing a color button four times returns to original state', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const btn = container.querySelector<HTMLElement>('.lab-btn-blue')!;
    btn.click();
    btn.click();
    btn.click();
    btn.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (let i = 0; i < 9; i++) {
      expect(arrowsAfter[i]).toBe(arrowsBefore[i]);
    }

    instance.destroy();
  });

  it('different color buttons rotate disjoint sets of cells', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const redIndices: number[] = [];
    const blueIndices: number[] = [];
    cells.forEach((c, i) => {
      const cls = c.className;
      if (cls.includes('lab-red')) redIndices.push(i);
      if (cls.includes('lab-blue')) blueIndices.push(i);
    });

    const redBtn = container.querySelector<HTMLElement>('.lab-btn-red')!;
    const blueBtn = container.querySelector<HTMLElement>('.lab-btn-blue')!;
    redBtn.click();
    blueBtn.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const bothRedAndBlue = redIndices.filter((i) => blueIndices.includes(i));
    const anyOther = Array.from(cells)
      .map((_, i) => i)
      .filter(
        (i) => !redIndices.includes(i) && !blueIndices.includes(i),
      );

    for (const i of redIndices) {
      const expectedIdx = (ARROW_ORDER.indexOf(arrowsBefore[i]) + 1) % 4;
      expect(arrowsAfter[i]).toBe(ARROW_ORDER[expectedIdx]);
    }

    for (const i of blueIndices) {
      if (bothRedAndBlue.includes(i)) continue;
      const expectedIdx = (ARROW_ORDER.indexOf(arrowsBefore[i]) + 1) % 4;
      expect(arrowsAfter[i]).toBe(ARROW_ORDER[expectedIdx]);
    }

    for (const i of bothRedAndBlue) {
      const expectedIdx = (ARROW_ORDER.indexOf(arrowsBefore[i]) + 2) % 4;
      expect(arrowsAfter[i]).toBe(ARROW_ORDER[expectedIdx]);
    }

    for (const i of anyOther) {
      expect(arrowsAfter[i]).toBe(arrowsBefore[i]);
    }

    instance.destroy();
  });

  it('destroy cleans up the container', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    instance.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('top-left cell never starts pointing down', () => {
    for (let t = 0; t < 20; t++) {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const instance = labPuzzle.create(container, ctx);

      const cells = container.querySelectorAll('.lab-cell');
      const arrow0 = cells[0].querySelector('.lab-arrow')!.textContent;
      expect(arrow0).not.toBe('↓');

      instance.destroy();
    }
  });

  it('plays a tone when a color button is pressed', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    container.querySelector<HTMLElement>('.lab-btn-green')!.click();

    expect(ctx.playTone).toHaveBeenCalledOnce();

    instance.destroy();
  });

  it('applies flash class on color press', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const redIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains('lab-red')) redIndices.push(i);
    });

    container.querySelector<HTMLElement>('.lab-btn-red')!.click();

    for (const i of redIndices) {
      expect(cells[i].classList.contains('lab-flash')).toBe(true);
    }

    // Clean up pending timeouts
    instance.destroy();
  });
});
