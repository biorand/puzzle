import { afterEach, describe, expect, it, vi } from 'vitest';
import { labPuzzle } from '../../src/puzzles/labPuzzle';
import type { PuzzleContext } from '../../src/types';

const PLAY_ORDER = ['▲', '▶', '▼', '◀'];

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

  it('creates 9 clickable cells', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    expect(cells.length).toBe(9);

    for (let i = 0; i < 9; i++) {
      const arrow = cells[i].querySelector('.lab-arrow');
      expect(arrow).not.toBeNull();
      expect(PLAY_ORDER).toContain(arrow!.textContent);
    }

    expect(container.querySelectorAll('.lab-btn').length).toBe(0);

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

  it('clicking a cell increments moves', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    vi.mocked(ctx.setStatus).mockClear();

    container.querySelector<HTMLElement>('.lab-cell')!.click();
    expect(ctx.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ moves: 1 }),
    );

    instance.destroy();
  });

  it('clicking cells increments moves each time', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    vi.mocked(ctx.setStatus).mockClear();

    const cells = container.querySelectorAll<HTMLElement>('.lab-cell');
    cells[0].click();
    cells[1].click();
    cells[2].click();

    expect(ctx.setStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ moves: 3 }),
    );

    instance.destroy();
  });

  it('clicking a cell rotates all same-colour cells anti-clockwise', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const firstTarget = Array.from(cells).find(
      (c) =>
        c.classList.contains('lab-blue') ||
        c.classList.contains('lab-green') ||
        c.classList.contains('lab-yellow') ||
        c.classList.contains('lab-red'),
    )!;
    const targetColor = Array.from(firstTarget.classList).find(
      (c) => c.startsWith('lab-') && c !== 'lab-cell' && c !== 'lab-powered' && c !== 'lab-start' && c !== 'lab-goal' && c !== 'lab-flash',
    )!;

    const targetIndices: number[] = [];
    const otherIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains(targetColor)) targetIndices.push(i);
      else otherIndices.push(i);
    });

    expect(targetIndices.length).toBeGreaterThan(0);

    firstTarget.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (const i of targetIndices) {
      const expectedIdx = (PLAY_ORDER.indexOf(arrowsBefore[i]) - 1 + 4) % 4;
      expect(arrowsAfter[i]).toBe(PLAY_ORDER[expectedIdx]);
    }

    for (const i of otherIndices) {
      expect(arrowsAfter[i]).toBe(arrowsBefore[i]);
    }

    instance.destroy();
  });

  it('clicking a cell twice rotates same-colour cells 180 degrees', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const firstTarget = Array.from(cells).find(
      (c) =>
        c.classList.contains('lab-blue') ||
        c.classList.contains('lab-green') ||
        c.classList.contains('lab-yellow') ||
        c.classList.contains('lab-red'),
    )!;
    const targetColor = Array.from(firstTarget.classList).find(
      (c) => c.startsWith('lab-') && c !== 'lab-cell' && c !== 'lab-powered' && c !== 'lab-start' && c !== 'lab-goal' && c !== 'lab-flash',
    )!;

    const targetIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains(targetColor)) targetIndices.push(i);
    });

    firstTarget.click();
    firstTarget.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (const i of targetIndices) {
      const expectedIdx = (PLAY_ORDER.indexOf(arrowsBefore[i]) - 2 + 8) % 4;
      expect(arrowsAfter[i]).toBe(PLAY_ORDER[expectedIdx]);
    }

    instance.destroy();
  });

  it('clicking a cell four times returns to original state', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const first = cells[0];
    first.click();
    first.click();
    first.click();
    first.click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    for (let i = 0; i < 9; i++) {
      expect(arrowsAfter[i]).toBe(arrowsBefore[i]);
    }

    instance.destroy();
  });

  it('clicking cells of different colours rotates disjoint sets', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const arrowsBefore = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const COL_CLASSES = ['lab-blue', 'lab-green', 'lab-yellow', 'lab-red'];
    function getIndices(cls: string): number[] {
      const idx: number[] = [];
      cells.forEach((c, i) => { if (c.classList.contains(cls)) idx.push(i); });
      return idx;
    }
    const colorSets = COL_CLASSES.map(getIndices).filter((a) => a.length > 0);
    expect(colorSets.length).toBeGreaterThanOrEqual(2);

    const [colorA, colorB] = colorSets;

    cells[colorA[0]].click();
    cells[colorB[0]].click();

    const arrowsAfter = Array.from(cells).map(
      (c) => c.querySelector('.lab-arrow')!.textContent!,
    );

    const neither = Array.from(cells)
      .map((_, i) => i)
      .filter((i) => !colorA.includes(i) && !colorB.includes(i));

    for (const i of colorA) {
      const expectedIdx = (PLAY_ORDER.indexOf(arrowsBefore[i]) - 1 + 4) % 4;
      expect(arrowsAfter[i]).toBe(PLAY_ORDER[expectedIdx]);
    }

    for (const i of colorB) {
      const expectedIdx = (PLAY_ORDER.indexOf(arrowsBefore[i]) - 1 + 4) % 4;
      expect(arrowsAfter[i]).toBe(PLAY_ORDER[expectedIdx]);
    }

    for (const i of neither) {
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
      expect(arrow0).not.toBe('▼');

      instance.destroy();
    }
  });

  it('plays a tone when a cell is clicked', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    container.querySelector<HTMLElement>('.lab-cell')!.click();

    expect(ctx.playTone).toHaveBeenCalledOnce();

    instance.destroy();
  });

  it('applies flash class on cell click', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = labPuzzle.create(container, ctx);

    const cells = container.querySelectorAll('.lab-cell');
    const firstTarget = Array.from(cells).find(
      (c) =>
        c.classList.contains('lab-blue') ||
        c.classList.contains('lab-green') ||
        c.classList.contains('lab-yellow') ||
        c.classList.contains('lab-red'),
    )!;
    const targetColor = Array.from(firstTarget.classList).find(
      (c) => c.startsWith('lab-') && c !== 'lab-cell' && c !== 'lab-powered' && c !== 'lab-start' && c !== 'lab-goal' && c !== 'lab-flash',
    )!;

    const targetIndices: number[] = [];
    cells.forEach((c, i) => {
      if (c.classList.contains(targetColor)) targetIndices.push(i);
    });

    firstTarget.click();

    for (const i of targetIndices) {
      expect(cells[i].classList.contains('lab-flash')).toBe(true);
    }

    instance.destroy();
  });
});
