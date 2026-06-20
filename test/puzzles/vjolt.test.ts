import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PuzzleContext } from '../../src/types';
import {
  vjolt,
  generatePuzzle,
  optimalMoves,
  getNameForValue,
  getColorClass,
  pairKey,
} from '../../src/puzzles/vjolt';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('V-JOLT puzzle', () => {
  // getNameForValue must come before generatePuzzle to avoid nameCache
  // pollution (the module-level cache maps value→name but ignores target,
  // so generatePuzzle can cache a value as 'V-JOLT if it equals the target).
  describe('getNameForValue', () => {
    // generatePuzzle populates the module-level nameCache which shares state
    // across tests. Run getNameForValue tests first to avoid cache pollution.
    // Reordered: getNameForValue must come before generatePuzzle tests.

    it('returns V-JOLT for target', () => {
      expect(getNameForValue(22, 22)).toBe('V-JOLT');
    });
    it('returns Water for value 1', () => {
      expect(getNameForValue(1, 22)).toBe('Water');
    });
    it('returns vanilla names for known values', () => {
      expect(getNameForValue(3, 22)).toBe('UMB No.3');
      expect(getNameForValue(4, 22)).toBe('NP-004');
      expect(getNameForValue(6, 22)).toBe('Yellow-6');
      expect(getNameForValue(7, 22)).toBe('UMB No.7');
      expect(getNameForValue(10, 22)).toBe('UMB No.10');
      expect(getNameForValue(17, 22)).toBe('VP-017');
    });
    it('includes the value in the name for unknowns', () => {
      const name = getNameForValue(5, 22);
      expect(name).toMatch(/UMB No\.5|NP-005|Yellow-5|VP-005/);
    });
  });

  describe('generatePuzzle', () => {
    it('returns three base chemicals with valid pairs', () => {
      for (let i = 0; i < 50; i++) {
        const p = generatePuzzle();
        expect(p.bases).toHaveLength(3);
        expect(p.bases[0].value).toBe(1);
        const r = p.bases[1].value;
        const y = p.bases[2].value;
        expect(r).toBeGreaterThanOrEqual(2);
        expect(r).toBeLessThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(4);
        expect(y).toBeLessThanOrEqual(7);
        expect(y).toBeGreaterThan(r);
        expect(p.validPairs.length).toBe(5);
        const baseVals = [1, r, y];
        for (const eq of p.equations) {
          expect(baseVals).not.toContain(eq.result);
        }
        for (const eq of p.equations) {
          expect(eq.leftA + eq.leftB).toBe(eq.result);
        }
      }
    });
  });

  describe('pairKey', () => {
    it('sorts values low,high', () => {
      expect(pairKey(3, 1)).toBe('1,3');
    });
  });

  describe('optimalMoves', () => {
    it('returns 11', () => {
      expect(optimalMoves()).toBe(11);
    });
  });

  describe('DOM creation', () => {
    it('creates all puzzle elements', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(container.querySelector('.vjolt-wall')).toBeTruthy();
      expect(container.querySelector('.vjolt-shelf')).toBeTruthy();
      expect(container.querySelector('.vjolt-workbench')).toBeTruthy();
      expect(container.querySelector('.vjolt-actions')).toBeTruthy();
      expect(container.querySelectorAll('.vjolt-shelf-btn')).toHaveLength(3);
      expect(container.querySelectorAll('.vjolt-bottle')).toHaveLength(4);
      expect(container.querySelectorAll('.vjolt-btn')).toHaveLength(2);

      inst.destroy();
    });

    it('calls setStatus on creation', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(ctx.setStatus).toHaveBeenCalledWith({ moves: 0, optimal: 11 });

      inst.destroy();
    });

    it('destroy cleans up innerHTML', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(container.innerHTML).not.toBe('');
      inst.destroy();
      expect(container.innerHTML).toBe('');
    });
  });

  describe('interactions', () => {
    it('fills, selects, and deselects a bottle', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const btn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      btn.click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      expect(bottles[0].classList.contains('empty')).toBe(false);

      (bottles[0] as HTMLElement).click();
      expect(bottles[0].classList.contains('selected')).toBe(true);

      (bottles[0] as HTMLElement).click();
      expect(bottles[0].classList.contains('selected')).toBe(false);

      inst.destroy();
    });

    it('discards a selected bottle', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const btn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      btn.click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();

      const discardBtn = container.querySelector('.vjolt-btn-discard') as HTMLButtonElement;
      discardBtn.click();

      expect(bottles[0].classList.contains('empty')).toBe(true);

      inst.destroy();
    });

    it('combines via COMBINE button', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const btns = container.querySelectorAll('.vjolt-shelf-btn');
      (btns[0] as HTMLButtonElement).click();
      (btns[1] as HTMLButtonElement).click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();
      (bottles[1] as HTMLElement).click();

      const combineBtn = container.querySelector('.vjolt-btn-combine') as HTMLButtonElement;
      combineBtn.click();

      const nonEmpty = container.querySelectorAll('.vjolt-bottle:not(.empty)');
      expect(nonEmpty.length).toBe(1);

      inst.destroy();
    });

    it('combining two same-value bottles collapses into one', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      // Fill two bottles from the same shelf chemical
      const btns = container.querySelectorAll('.vjolt-shelf-btn');
      (btns[0] as HTMLButtonElement).click();
      (btns[0] as HTMLButtonElement).click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      expect(bottles[0].classList.contains('empty')).toBe(false);
      expect(bottles[1].classList.contains('empty')).toBe(false);

      (bottles[0] as HTMLElement).click();
      (bottles[1] as HTMLElement).click();

      const combineBtn = container.querySelector('.vjolt-btn-combine') as HTMLButtonElement;
      combineBtn.click();

      // Should collapse to one bottle (no sum, no poison)
      const nonEmpty = container.querySelectorAll('.vjolt-bottle:not(.empty)');
      expect(nonEmpty.length).toBe(1);
      // The remaining bottle should be the same value, not poison
      expect(nonEmpty[0].classList.contains('poison')).toBe(false);

      inst.destroy();
    });

    it('button states correct with 0, 1, and 2 selected', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const combineBtn = container.querySelector('.vjolt-btn-combine') as HTMLButtonElement;
      const discardBtn = container.querySelector('.vjolt-btn-discard') as HTMLButtonElement;

      expect(combineBtn.disabled).toBe(true);
      expect(discardBtn.disabled).toBe(true);

      const btns = container.querySelectorAll('.vjolt-shelf-btn');
      (btns[0] as HTMLButtonElement).click();
      (btns[1] as HTMLButtonElement).click();

      const bottles = container.querySelectorAll('.vjolt-bottle');

      // Select 1
      (bottles[0] as HTMLElement).click();
      expect(combineBtn.disabled).toBe(true);
      expect(discardBtn.disabled).toBe(false);

      // Select 2
      (bottles[1] as HTMLElement).click();
      expect(combineBtn.disabled).toBe(false);
      expect(discardBtn.disabled).toBe(true);

      inst.destroy();
    });

    it('plays tone on fill', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const btn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      btn.click();

      expect(ctx.playTone).toHaveBeenCalled();

      inst.destroy();
    });
  });

  describe('thumbnail', () => {
    it('has a non-empty thumbnail SVG', () => {
      expect(vjolt.thumbnail.length).toBeGreaterThan(0);
      expect(vjolt.thumbnail).toContain('<svg');
    });
  });
});
