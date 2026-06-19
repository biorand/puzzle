import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PuzzleContext } from '../../src/types';
import { vjolt, generatePuzzle, optimalMoves, getNameForValue, getColorClass } from '../../src/puzzles/vjolt';

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
  describe('generatePuzzle', () => {
    it('returns three base chemicals with valid values', () => {
      for (let i = 0; i < 50; i++) {
        const p = generatePuzzle();
        expect(p.bases).toHaveLength(3);
        expect(p.bases[0].value).toBeGreaterThanOrEqual(1);
        expect(p.bases[0].value).toBeLessThanOrEqual(3);
        expect(p.bases[1].value).toBeGreaterThanOrEqual(2);
        expect(p.bases[1].value).toBeLessThanOrEqual(5);
        expect(p.bases[2].value).toBeGreaterThanOrEqual(3);
        expect(p.bases[2].value).toBeLessThanOrEqual(7);
      }
    });

    it('generates a reachable target value', () => {
      for (let i = 0; i < 50; i++) {
        const p = generatePuzzle();
        const allValues = p.bases.map((b) => b.value);
        expect(p.target).toBeGreaterThan(Math.max(...allValues));
        // Target should be the last equation result
        const lastEq = p.equations[p.equations.length - 1];
        expect(p.target).toBe(lastEq.result);
      }
    });

    it('generates five equations forming a complete chain', () => {
      const p = generatePuzzle();
      expect(p.equations).toHaveLength(5);
      // Each equation: leftA + leftB = result
      for (const eq of p.equations) {
        expect(eq.leftA + eq.leftB).toBe(eq.result);
      }
    });
  });

  describe('optimalMoves', () => {
    it('returns 12', () => {
      expect(optimalMoves()).toBe(12);
    });
  });

  describe('getNameForValue', () => {
    it('returns V-JOLT for target value', () => {
      expect(getNameForValue(22, 22)).toBe('V-JOLT');
    });

    it('returns VP- prefixed name for values >= 15', () => {
      const name = getNameForValue(17, 22);
      expect(name).toBe('VP-17');
    });

    it('returns UMB No. for values 10-14', () => {
      expect(getNameForValue(12, 22)).toBe('UMB No.12');
    });

    it('returns NP-00 for values 4-6', () => {
      expect(getNameForValue(5, 22)).toBe('NP-005');
    });
  });

  describe('getColorClass', () => {
    it('returns vjolt-brown for target value', () => {
      expect(getColorClass(22, 22)).toBe('vjolt-brown');
    });

    it('returns vjolt-darkblue for values 15-19', () => {
      expect(getColorClass(16, 22)).toBe('vjolt-darkblue');
    });

    it('returns vjolt-orange for values 10-14', () => {
      expect(getColorClass(11, 22)).toBe('vjolt-orange');
    });

    it('returns vjolt-green for values 7-9', () => {
      expect(getColorClass(8, 22)).toBe('vjolt-green');
    });

    it('returns vjolt-purple for values 4-6', () => {
      expect(getColorClass(4, 22)).toBe('vjolt-purple');
    });

    it('returns vjolt-gray for values 1-3', () => {
      expect(getColorClass(2, 22)).toBe('vjolt-gray');
    });
  });

  describe('DOM creation', () => {
    it('creates wall, shelf, workbench, and actions', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(container.querySelector('.vjolt-wall')).toBeTruthy();
      expect(container.querySelector('.vjolt-shelf')).toBeTruthy();
      expect(container.querySelector('.vjolt-workbench')).toBeTruthy();
      expect(container.querySelector('.vjolt-actions')).toBeTruthy();

      inst.destroy();
    });

    it('creates 3 shelf buttons', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const btns = container.querySelectorAll('.vjolt-shelf-btn');
      expect(btns).toHaveLength(3);

      inst.destroy();
    });

    it('creates 4 workbench slots', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const bottles = container.querySelectorAll('.vjolt-bottle');
      expect(bottles).toHaveLength(4);

      inst.destroy();
    });

    it('creates 2 action buttons (TEST + DISCARD)', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const actions = container.querySelectorAll('.vjolt-btn');
      expect(actions).toHaveLength(2);

      inst.destroy();
    });

    it('calls setStatus on creation', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(ctx.setStatus).toHaveBeenCalledTimes(1);
      expect(ctx.setStatus).toHaveBeenCalledWith({ moves: 0, optimal: 12 });

      inst.destroy();
    });

    it('calls setActions on creation', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(ctx.setActions).toHaveBeenCalledTimes(1);

      inst.destroy();
    });

    it('destroy cleans up container innerHTML', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      expect(container.innerHTML).not.toBe('');
      inst.destroy();
      expect(container.innerHTML).toBe('');
    });

    it('fills a bottle when shelf button is clicked', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const firstBtn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      firstBtn.click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      const filledBottle = bottles[0];
      expect(filledBottle.classList.contains('empty')).toBe(false);

      inst.destroy();
    });

    it('selects a bottle on click', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const firstBtn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      firstBtn.click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();
      expect(bottles[0].classList.contains('selected')).toBe(true);

      inst.destroy();
    });

    it('deselects on second click', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const firstBtn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      firstBtn.click();

      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();
      (bottles[0] as HTMLElement).click();
      expect(bottles[0].classList.contains('selected')).toBe(false);

      inst.destroy();
    });

    it('discards a selected bottle', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const firstBtn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      firstBtn.click();

      const discardBtn = container.querySelector('.vjolt-btn-discard') as HTMLButtonElement;
      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();
      discardBtn.click();

      expect(bottles[0].classList.contains('empty')).toBe(true);

      inst.destroy();
    });

    it('plays tone on fill', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      const firstBtn = container.querySelector('.vjolt-shelf-btn') as HTMLButtonElement;
      firstBtn.click();

      expect(ctx.playTone).toHaveBeenCalled();

      inst.destroy();
    });

    it('combines two bottles into one', () => {
      const container = document.createElement('div');
      const ctx = createMockContext();
      const inst = vjolt.create(container, ctx);

      // Fill 2 bottles
      const btns = container.querySelectorAll('.vjolt-shelf-btn');
      (btns[0] as HTMLButtonElement).click();
      (btns[1] as HTMLButtonElement).click();

      // Combine them
      const bottles = container.querySelectorAll('.vjolt-bottle');
      (bottles[0] as HTMLElement).click();
      (bottles[1] as HTMLElement).click();

      // Should now have 1 bottle (combined) + 1 empty
      const nonEmpty = container.querySelectorAll('.vjolt-bottle:not(.empty)');
      expect(nonEmpty.length).toBe(1);

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
