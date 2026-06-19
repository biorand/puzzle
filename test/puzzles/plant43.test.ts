import { describe, it, expect } from 'vitest';
import {
  apply,
  bfsAll,
  CAPACITIES,
  START_FILLS,
  START_SLOTS,
  isWin,
  generateRandomStart,
  generatePuzzle,
} from '../../src/puzzles/plant43';
import type { Action } from '../../src/puzzles/plant43';

function state(
  fills: [number, number, number],
  slots: [number, number, number],
) {
  return { fills, slots };
}

describe('plant43 state machine', () => {
  it('red swaps left and middle slots', () => {
    const s = state([7, 0, 0], [1, 0, 2]);
    const next = apply(s, 'red');
    expect(next.slots).toEqual([0, 1, 2]);
    expect(next.fills).toEqual([7, 0, 0]);
  });

  it('blue swaps middle and right slots', () => {
    const s = state([7, 0, 0], [1, 0, 2]);
    const next = apply(s, 'blue');
    expect(next.slots).toEqual([1, 2, 0]);
    expect(next.fills).toEqual([7, 0, 0]);
  });

  it('green pours from middle to left limited by left capacity', () => {
    const s = state([7, 0, 0], [1, 0, 2]);
    const next = apply(s, 'green');
    expect(next.fills).toEqual([2, 5, 0]);
    expect(next.slots).toEqual([1, 0, 2]);
  });

  it('green does nothing (null) when middle is empty', () => {
    const s = state([5, 0, 2], [0, 1, 2]);
    const next = apply(s, 'green');
    expect(next).toBeNull();
  });

  it('green does nothing (null) when left is full', () => {
    const s = state([7, 3, 0], [0, 1, 2]);
    const next = apply(s, 'green');
    expect(next).toBeNull();
  });

  it('green pours partial amount when left has limited space', () => {
    const s = state([5, 5, 0], [0, 1, 2]);
    const next = apply(s, 'green');
    expect(next.fills).toEqual([7, 3, 0]);
  });

  it('total liquid is conserved across actions', () => {
    const s = state([7, 0, 0], [1, 0, 2]);
    const total = (f: number[]) => f.reduce((a, b) => a + b, 0);
    expect(total(s.fills)).toBe(7);

    for (const action of ['red', 'blue', 'green'] as Action[]) {
      const next = apply(s, action);
      expect(total(next.fills)).toBe(7);
    }
  });

  it('isWin detects correct win state', () => {
    expect(isWin(state([5, 2, 0], [0, 2, 1]), 5)).toBe(true);
  });

  it('isWin detects win with any tube in left slot', () => {
    // tube 1 (fill 2) in left slot, target 2
    expect(isWin(state([5, 2, 0], [1, 0, 2]), 2)).toBe(true);
  });

  it('isWin rejects wrong fill level', () => {
    expect(isWin(state([4, 3, 0], [0, 2, 1]), 5)).toBe(false);
  });

  it('isWin rejects wrong fill regardless of which tube is in left slot', () => {
    // tube 2 (fill 0) in left slot, target 2
    expect(isWin(state([5, 3, 0], [2, 0, 1]), 2)).toBe(false);
  });

  it('BFS reaches expected number of states', () => {
    const results = bfsAll();
    expect(results.size).toBe(90);
  });

  it('BFS finds known 7-move solution for fill=5', () => {
    const results = bfsAll();
    const key = '1,0,2|7,0,0';
    const start = results.get(key)!;
    expect(start.moves).toBe(0);

    const targetKey = '0,2,1|5,2,0';
    const target = results.get(targetKey);
    expect(target).toBeDefined();
    expect(target!.moves).toBe(7);
    expect(target!.path).toEqual(['green', 'blue', 'red', 'green', 'blue', 'red', 'green']);
  });

  it('candidate targets exclude tube capacities (3, 5, 7)', () => {
    const results = bfsAll();
    const candidates = Array.from(results.values()).filter(
      (e) =>
        e.moves >= 4 &&
        (() => {
          const f = e.state.fills[e.state.slots[0]];
          return f > 0 && f < 7 && !CAPACITIES.includes(f);
        })(),
    );
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    for (const c of candidates) {
      expect([1, 2, 4, 6]).toContain(c.state.fills[c.state.slots[0]]);
    }
  });

  it('generateRandomStart produces valid states', () => {
    for (const total of [4, 6, 8, 10, 12]) {
      const s = generateRandomStart(total);
      expect(s.slots).toEqual([1, 0, 2]);
      const sum = s.fills[0] + s.fills[1] + s.fills[2];
      expect(sum).toBe(total);
      expect(s.fills[0]).toBeGreaterThanOrEqual(0);
      expect(s.fills[0]).toBeLessThanOrEqual(CAPACITIES[0]);
      expect(s.fills[1]).toBeGreaterThanOrEqual(0);
      expect(s.fills[1]).toBeLessThanOrEqual(CAPACITIES[1]);
      expect(s.fills[2]).toBeGreaterThanOrEqual(0);
      expect(s.fills[2]).toBeLessThanOrEqual(CAPACITIES[2]);
    }
  });

  it('generatePuzzle returns valid config with non-capacity target', () => {
    for (let i = 0; i < 20; i++) {
      const cfg = generatePuzzle();
      expect(cfg.targetFill).toBeGreaterThan(0);
      expect(cfg.targetFill).toBeLessThan(7);
      expect(cfg.targetFill).not.toBe(CAPACITIES[1]);
      expect(cfg.targetFill).not.toBe(CAPACITIES[2]);
      expect(cfg.optimalMoves).toBeGreaterThanOrEqual(4);
      expect(cfg.solution.length).toBe(cfg.optimalMoves);
      expect(cfg.solution.length).toBeGreaterThan(0);
      const startSum =
        cfg.startState.fills[0] + cfg.startState.fills[1] + cfg.startState.fills[2];
      expect(startSum).toBeGreaterThanOrEqual(4);
      expect(startSum).toBeLessThanOrEqual(12);
    }
  });

  it('optimalMoves is the minimum path to the target fill value', () => {
    for (let i = 0; i < 20; i++) {
      const cfg = generatePuzzle();
      const reachable = bfsAll(cfg.startState);
      const fill = cfg.targetFill;
      let minMoves = Infinity;
      for (const entry of reachable.values()) {
        if (entry.state.fills[entry.state.slots[0]] === fill) {
          minMoves = Math.min(minMoves, entry.moves);
        }
      }
      expect(minMoves).toBe(cfg.optimalMoves);
    }
  });
});
