import { describe, it, expect, vi, afterEach } from 'vitest';
import { portableSafe } from '../../src/puzzles/portableSafe';
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

/**
 * Deterministic mock for Math.random that makes shuffle() produce
 * mapping = [0, 2, 1, 3, 4, 5, 6, 7].
 *
 * mapping table:
 *   button 0 → light 0,  button 1 → light 2
 *   button 2 → light 1,  button 3 → light 3
 *   button 4 → light 4,  button 5 → light 5
 *   button 6 → light 6,  button 7 → light 7
 */
const MOCK_RANDOMS = [0.9, 0.9, 0.9, 0.9, 0.9, 0.4, 0.6];

describe('portableSafe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables a button that was pressed as first in the chain', () => {
    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = portableSafe.create(container, ctx);

    const buttons = container.querySelectorAll<HTMLButtonElement>('button.safe-btn');
    expect(buttons.length).toBe(8);

    buttons[0].click();

    expect(buttons[0].disabled).toBe(true);

    instance.destroy();
  });

  it('starts a new chain from the wrong button instead of disabling it', () => {
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return MOCK_RANDOMS[callCount++ % MOCK_RANDOMS.length];
    });

    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = portableSafe.create(container, ctx);

    const buttons = container.querySelectorAll<HTMLButtonElement>('button.safe-btn');

    // Click button 0 → chain at light 0.  Expected next: light 1.
    buttons[0].click();
    expect(buttons[0].disabled).toBe(true);

    // Click button 1 (mapping[1]=2, expected=1) → WRONG.
    // New behavior: starts a new chain at light 2 instead of going into wrongFlash.
    buttons[1].click();

    // button 1 (light 2) is now in the new chain → disabled
    expect(buttons[1].disabled).toBe(true);

    // button 0 (light 0) is NOT in the new chain (startIdx=2, end=3) → re-enabled
    expect(buttons[0].disabled).toBe(false);

    instance.destroy();
  });

  it('continues the chain correctly after a wrong press resets it', () => {
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return MOCK_RANDOMS[callCount++ % MOCK_RANDOMS.length];
    });

    const container = document.createElement('div');
    const ctx = createMockContext();
    const instance = portableSafe.create(container, ctx);

    const buttons = container.querySelectorAll<HTMLButtonElement>('button.safe-btn');

    // Click button 0 → chain at light 0.  Expected next: light 1.
    buttons[0].click();

    // Click button 1 (light 2, expected=1) → WRONG → new chain at light 2. Expected: light 3.
    buttons[1].click();

    // Click button 3 (light 3) → CORRECT → chain=2
    buttons[3].click();

    // Both button 1 (light 2) and button 3 (light 3) in chain
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[3].disabled).toBe(true);

    // Expected next is light 4 → button 4 (light 4) is correct
    buttons[4].click();
    expect(buttons[4].disabled).toBe(true);

    instance.destroy();
  });
});
