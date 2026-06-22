import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleLabCircuit } from '../../src/puzzles/puzzle-lab-circuit';
import type { PuzzleNode, PuzzleState } from '../../src/puzzles/puzzle-lab-circuit';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

import { calculatePower, isSolved, activeDirs } from '../../src/puzzles/puzzle-lab-circuit';

describe('activeDirs', () => {
    it('T rot=0 excludes DOWN', () => {
        const dirs = activeDirs('T', 0);
        expect(dirs).toContain('UP');
        expect(dirs).toContain('RIGHT');
        expect(dirs).toContain('LEFT');
        expect(dirs).not.toContain('DOWN');
    });

    it('T rot=1 excludes RIGHT', () => {
        const dirs = activeDirs('T', 1);
        expect(dirs).toContain('UP');
        expect(dirs).toContain('DOWN');
        expect(dirs).toContain('LEFT');
        expect(dirs).not.toContain('RIGHT');
    });

    it('T rot=2 excludes UP', () => {
        const dirs = activeDirs('T', 2);
        expect(dirs).toContain('RIGHT');
        expect(dirs).toContain('DOWN');
        expect(dirs).toContain('LEFT');
        expect(dirs).not.toContain('UP');
    });

    it('T rot=3 excludes LEFT', () => {
        const dirs = activeDirs('T', 3);
        expect(dirs).toContain('RIGHT');
        expect(dirs).toContain('DOWN');
        expect(dirs).toContain('UP');
        expect(dirs).not.toContain('LEFT');
    });

    it('L rot=0 connects UP and RIGHT only', () => {
        const dirs = activeDirs('L', 0);
        expect(dirs).toEqual(['UP', 'RIGHT']);
    });

    it('L rot=1 connects LEFT and UP', () => {
        const dirs = activeDirs('L', 1);
        expect(dirs).toEqual(['LEFT', 'UP']);
    });

    it('L rot=2 connects DOWN and LEFT', () => {
        const dirs = activeDirs('L', 2);
        expect(dirs).toEqual(['DOWN', 'LEFT']);
    });

    it('L rot=3 connects RIGHT and DOWN', () => {
        const dirs = activeDirs('L', 3);
        expect(dirs).toEqual(['RIGHT', 'DOWN']);
    });

    it('diag rot=0 connects UP↔RIGHT and DOWN↔LEFT', () => {
        const dirs = activeDirs('diag', 0);
        expect(dirs).toEqual(['UP', 'RIGHT', 'DOWN', 'LEFT']);
    });
});

describe('calculatePower', () => {
    function makeState(
        nodes: PuzzleNode[],
        edges: { from: number; fromPort: string; to: number; toPort: string }[],
        ringCount: number,
    ): PuzzleState {
        return {
            nodes,
            edges: edges as any,
            ringCount,
            optimal: 0,
        };
    }

    it('T rot=0 at position 1: UP, RIGHT, LEFT active, DOWN excluded', () => {
        // position 1 at (0, -10), corners at (-10, -10) and (10, -10), center at (0, 10)
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'T', x: 0, y: 0 },
                { kind: 'node', x: -10, y: 0 },
                { kind: 'node', x: 10, y: 0 },
                { kind: 'receiver', x: 0, y: 10 },
            ],
            [
                { from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
                { from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
                { from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
                { from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
                { from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
            ],
            1,
        );
        const powered = calculatePower(state, [0]);
        // source and power_corner always powered
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        // junction powered (UP active)
        expect(powered.has(2)).toBe(true);
        // LEFT and RIGHT powered
        expect(powered.has(3)).toBe(true);
        expect(powered.has(4)).toBe(true);
        // DOWN excluded
        expect(powered.has(5)).toBe(false);
    });

    it('T rot=2 at position 1: UP excluded, power cannot enter', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'T', x: 0, y: 0 },
                { kind: 'receiver', x: -10, y: 0 },
                { kind: 'receiver', x: 10, y: 0 },
                { kind: 'receiver', x: 0, y: 10 },
            ],
            [
                { from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
                { from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
                { from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
                { from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
                { from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
            ],
            1,
        );
        // rot=2: UP excluded → source can't enter the junction
        const powered = calculatePower(state, [2]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(false);
        expect(powered.has(3)).toBe(false);
        expect(powered.has(4)).toBe(false);
        expect(powered.has(5)).toBe(false);
    });

    it('L rot=0: only UP↔RIGHT, DOWN excluded', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'L', x: 0, y: 0 },
                { kind: 'receiver', x: -10, y: 0 },
                { kind: 'receiver', x: 10, y: 0 },
                { kind: 'receiver', x: 0, y: 10 },
            ],
            [
                { from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
                { from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
                { from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
                { from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
                { from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
            ],
            1,
        );
        // L rot=0: UP↔RIGHT → LEFT and DOWN excluded
        const powered = calculatePower(state, [0]);
        expect(powered.has(2)).toBe(true);
        expect(powered.has(4)).toBe(true); // RIGHT connected
        expect(powered.has(3)).toBe(false); // LEFT excluded
        expect(powered.has(5)).toBe(false); // DOWN excluded
    });

    it('Diag rot=0 at position 1: UP↔RIGHT and DOWN↔LEFT as separate channels', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
                { kind: 'receiver', x: -10, y: 0 }, // LEFT
                { kind: 'receiver', x: 10, y: 0 }, // RIGHT
                { kind: 'receiver', x: 0, y: 10 }, // DOWN (inter-ring / center)
            ],
            [
                { from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
                { from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
                { from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
                { from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
                { from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
            ],
            1,
        );
        // Diag rot=0: UP↔RIGHT (pair 0), DOWN↔LEFT (pair 1)
        // Power enters through UP, flows through pair 0 directly to RIGHT
        // DOWN↔LEFT is isolated — power doesn't reach DOWN or LEFT from source
        // Junction node itself is bypassed, not in powered set
        const powered = calculatePower(state, [0]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(4)).toBe(true);   // RIGHT: powered via UP↔RIGHT bypass
        expect(powered.has(3)).toBe(false);  // LEFT: isolated channel
        expect(powered.has(5)).toBe(false);  // DOWN: isolated channel
    });

    it('Diag rot=1 at position 1: RIGHT↔DOWN and LEFT↔UP as separate channels', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
                { kind: 'receiver', x: -10, y: 0 }, // LEFT
                { kind: 'receiver', x: 10, y: 0 }, // RIGHT
                { kind: 'receiver', x: 0, y: 10 }, // DOWN
            ],
            [
                { from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
                { from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
                { from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
                { from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
                { from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
            ],
            1,
        );
        // Diag rot=1: pair 0 = RIGHT↔DOWN, pair 1 = LEFT↔UP
        // Power enters through UP → paired with LEFT → LEFT powered
        // DOWN is paired with RIGHT (pair 0) — no power from source
        // Junction node itself is bypassed, not in powered set
        const powered = calculatePower(state, [1]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(3)).toBe(true);   // LEFT: powered via UP↔LEFT bypass
        expect(powered.has(4)).toBe(false);  // RIGHT: isolated channel
        expect(powered.has(5)).toBe(false);  // DOWN: isolated channel
    });
});

describe('puzzle-lab-circuit', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-lab-circuit');
        expect(el).toBeInstanceOf(PuzzleLabCircuit);
    });

    it('dispatches puzzle-status on creation with moves=0', async () => {
        const el = document.createElement('puzzle-lab-circuit') as PuzzleLabCircuit;
        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);
        document.body.appendChild(el);
        await el.updateComplete;
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ moves: 0 }) }),
        );
        document.body.removeChild(el);
    });

    it('dispatches puzzle-actions on creation', async () => {
        const el = document.createElement('puzzle-lab-circuit') as PuzzleLabCircuit;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;
        expect(spy).toHaveBeenCalled();
        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle to moves=0', async () => {
        const el = document.createElement('puzzle-lab-circuit') as PuzzleLabCircuit;
        document.body.appendChild(el);
        await el.updateComplete;
        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);
        el.dispatchEvent(new CustomEvent('puzzle-regenerate'));
        await el.updateComplete;
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ moves: 0 }) }),
        );
        document.body.removeChild(el);
    });
});
