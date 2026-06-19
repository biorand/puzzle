import { afterEach, describe, expect, it, vi } from 'vitest';
import { slidingBlock } from '../../src/puzzles/slidingBlock';
import type { PuzzleContext } from '../../src/types';

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

describe('slidingBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the wrapping container and grid', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = slidingBlock.create(container, ctx);

    const wrap = container.querySelector('#sliding-wrap');
    expect(wrap).not.toBeNull();

    const grid = container.querySelector('#sliding-grid');
    expect(grid).not.toBeNull();

    instance.destroy();
  });

  it('creates 8 tiles (values 1–8)', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = slidingBlock.create(container, ctx);

    const tiles = container.querySelectorAll<HTMLElement>('.sliding-tile');
    expect(tiles.length).toBe(8);

    tiles.forEach((tile, i) => {
      expect(tile.dataset.value).toBe(String(i + 1));
    });

    instance.destroy();
  });

  it('calls setStatus after creation', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = slidingBlock.create(container, ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 0 }));

    instance.destroy();
  });

  it('sets actions on creation', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = slidingBlock.create(container, ctx);

    expect(ctx.setActions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'New Puzzle' }),
        expect.objectContaining({ label: 'Reset' }),
      ]),
    );

    instance.destroy();
  });

  it('destroy cleans up the container', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = slidingBlock.create(container, ctx);

    instance.destroy();
    expect(container.innerHTML).toBe('');
  });
});
