import { afterEach, describe, expect, it, vi } from 'vitest';
import { keypad } from '../../src/puzzles/keypad';
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

describe('keypad', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates 9 buttons inside #keypad', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = keypad.create(container, ctx);

    const keypadEl = container.querySelector('#keypad');
    expect(keypadEl).not.toBeNull();

    const buttons = container.querySelectorAll<HTMLButtonElement>('#keypad .cell');
    expect(buttons.length).toBe(9);

    buttons.forEach((btn, i) => {
      expect(btn.textContent).toBe(String(i + 1));
    });

    instance.destroy();
  });

  it('calls setStatus after creation', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = keypad.create(container, ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 0 }));

    instance.destroy();
  });

  it('sets actions on creation', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = keypad.create(container, ctx);

    expect(ctx.setActions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'New Puzzle' }),
        expect.objectContaining({ label: 'Reset' }),
      ]),
    );

    instance.destroy();
  });

  it('creates a tutorial div when tutorialStep is provided', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    ctx.tutorialStep = 0;
    ctx.tutorialTotal = 5;
    ctx.forceDifficulty = 1;
    const instance = keypad.create(container, ctx);

    const tutorialDiv = container.querySelector('#keypad-tutorial');
    expect(tutorialDiv).not.toBeNull();
    expect(tutorialDiv!.textContent).toContain('Tutorial 1/5');

    instance.destroy();
  });

  it('destroy cleans up the container', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = keypad.create(container, ctx);

    instance.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('press toggles a cell class and increments moves', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = keypad.create(container, ctx);

    const buttons = container.querySelectorAll<HTMLButtonElement>('#keypad .cell');
    buttons[0].click();

    expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 1 }));
    expect(ctx.playTone).toHaveBeenCalled();

    instance.destroy();
  });
});
