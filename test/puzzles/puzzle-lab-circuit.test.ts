import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleLabCircuit } from '../../src/puzzles/puzzle-lab-circuit';
import type { PuzzleNode, PuzzleState } from '../../src/puzzles/puzzle-lab-circuit';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

import { calculatePower, isSolved, activeDirs, isEdgePowered } from '../../src/puzzles/puzzle-lab-circuit';
import {
    calculatePowerResult,
    isJunctionStubPowered,
} from '../../src/puzzles/puzzle-lab-circuit';

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
            virtualSize: 512,
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
                { kind: 'socket', x: 0, y: 10 },
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
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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

    it('L rot=0: UP↔RIGHT, LEFT and DOWN excluded', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'L', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
                { kind: 'socket', x: -10, y: 0 }, // LEFT
                { kind: 'socket', x: 10, y: 0 }, // RIGHT
                { kind: 'socket', x: 0, y: 10 }, // DOWN (inter-ring / center)
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

    it('T rot=1: UP active → LEFT and DOWN powered, RIGHT blocked', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'T', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // T rot=1: LEFT, UP, DOWN active → UP enters, flows to LEFT and DOWN
        const powered = calculatePower(state, [1]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(true);
        expect(powered.has(3)).toBe(true);  // LEFT powered
        expect(powered.has(4)).toBe(false); // RIGHT blocked
        expect(powered.has(5)).toBe(true);  // DOWN powered
    });

    it('T rot=3: UP active → RIGHT and DOWN powered, LEFT blocked', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'T', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // T rot=3: RIGHT, DOWN, UP active → UP enters, flows to RIGHT and DOWN
        const powered = calculatePower(state, [3]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(true);
        expect(powered.has(3)).toBe(false); // LEFT blocked
        expect(powered.has(4)).toBe(true);  // RIGHT powered
        expect(powered.has(5)).toBe(true);  // DOWN powered
    });

    it('L rot=1: UP active → LEFT powered, RIGHT and DOWN blocked', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'L', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // L rot=1: LEFT, UP active → UP enters, flows to LEFT only
        const powered = calculatePower(state, [1]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(true);
        expect(powered.has(3)).toBe(true);  // LEFT powered
        expect(powered.has(4)).toBe(false); // RIGHT blocked
        expect(powered.has(5)).toBe(false); // DOWN blocked
    });

    it('L rot=2: UP blocked → no power enters junction', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'L', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // L rot=2: DOWN, LEFT active → UP excluded, power can't enter
        const powered = calculatePower(state, [2]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(false);
        expect(powered.has(3)).toBe(false);
        expect(powered.has(4)).toBe(false);
        expect(powered.has(5)).toBe(false);
    });

    it('L rot=3: UP blocked → no power enters junction', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'L', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // L rot=3: RIGHT, DOWN active → UP excluded, power can't enter
        const powered = calculatePower(state, [3]);
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(false);
        expect(powered.has(3)).toBe(false);
        expect(powered.has(4)).toBe(false);
        expect(powered.has(5)).toBe(false);
    });

    it('Diag rot=2: UP↔RIGHT pair active → RIGHT powered', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // Diag rot=2: pair 0 = DOWN↔LEFT, pair 1 = UP↔RIGHT
        // Power enters UP → bypassed to RIGHT
        const powered = calculatePower(state, [2]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(4)).toBe(true);   // RIGHT powered
        expect(powered.has(3)).toBe(false);  // LEFT isolated
        expect(powered.has(5)).toBe(false);  // DOWN isolated
    });

    it('Diag rot=3: LEFT↔UP pair active → LEFT powered', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 },
                { kind: 'socket', x: 10, y: 0 },
                { kind: 'socket', x: 0, y: 10 },
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
        // Diag rot=3: pair 0 = RIGHT↔DOWN, pair 1 = LEFT↔UP
        // Power enters UP → bypassed to LEFT
        const powered = calculatePower(state, [3]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(3)).toBe(true);   // LEFT powered
        expect(powered.has(4)).toBe(false);  // RIGHT isolated
        expect(powered.has(5)).toBe(false);  // DOWN isolated
    });

    it('Diag rot=1 at position 1: RIGHT↔DOWN and LEFT↔UP as separate channels', () => {
        const state = makeState(
            [
                { kind: 'source', x: 0, y: -24 },
                { kind: 'node', x: 0, y: -12 },
                { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
                { kind: 'socket', x: -10, y: 0 }, // LEFT
                { kind: 'socket', x: 10, y: 0 }, // RIGHT
                { kind: 'socket', x: 0, y: 10 }, // DOWN
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

describe('isEdgePowered', () => {
    const baseNodes: PuzzleNode[] = [
        { kind: 'source', x: 0, y: -24 },
        { kind: 'node', x: 0, y: -12 },
        { kind: 'junction', ring: 0, jType: 'T', x: 0, y: 0 },
        { kind: 'socket', x: -10, y: 0 },
        { kind: 'socket', x: 10, y: 0 },
        { kind: 'socket', x: 0, y: 10 },
    ];

    const baseEdges = [
        { from: 0, fromPort: 'DOWN' as const, to: 1, toPort: 'UP' as const },
        { from: 1, fromPort: 'DOWN' as const, to: 2, toPort: 'UP' as const },
        { from: 2, fromPort: 'LEFT' as const, to: 3, toPort: 'RIGHT' as const },
        { from: 2, fromPort: 'RIGHT' as const, to: 4, toPort: 'LEFT' as const },
        { from: 2, fromPort: 'DOWN' as const, to: 5, toPort: 'UP' as const },
    ];

    function make(nodes: PuzzleNode[], edges: typeof baseEdges, ringCount: number): PuzzleState {
        return { nodes, edges: edges as any, ringCount, optimal: 0, virtualSize: 512 };
    }

    it('T junc: edge through active port (UP) is powered', () => {
        // T rot=0: UP,RIGHT,LEFT active
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'T' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // Edge 1↔2 (node→junction via UP) — both ports through active paths
        expect(isEdgePowered(baseEdges[1], state, powered, [0])).toBe(true);
    });

    it('T junc: edge through inactive port (DOWN) is not powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'T' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // Edge 2↔5 (junction→socket via DOWN) — DOWN port inactive
        expect(isEdgePowered(baseEdges[4], state, powered, [0])).toBe(false);
    });

    it('T junc: edge from powered non-junction through blocked port (UP rot=2) is not powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'T' as const } : n)),
            baseEdges,
            1,
        );
        // T rot=2: UP excluded → corner node is powered but junction is not
        const powered = calculatePower(state, [2]);
        // Edge 1↔2 (node→junction via UP) — junction not powered, blocked port
        expect(isEdgePowered(baseEdges[1], state, powered, [2])).toBe(false);
    });

    it('T junc: edge through active port (RIGHT) is powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'T' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // Edge 2↔4 (junction→socket via RIGHT) — RIGHT port active
        expect(isEdgePowered(baseEdges[3], state, powered, [0])).toBe(true);
    });

    it('L junc: edge through active port (RIGHT) is powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'L' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // L rot=0: UP,RIGHT active → RIGHT port active
        expect(isEdgePowered(baseEdges[3], state, powered, [0])).toBe(true);
    });

    it('L junc: edge through inactive port (LEFT) is not powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'L' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // L rot=0: LEFT port inactive
        expect(isEdgePowered(baseEdges[2], state, powered, [0])).toBe(false);
    });

    it('L junc: incoming wire to a blocked port from a powered node is not powered (no leak through junction)', () => {
        // L rot=2: active {DOWN, LEFT} → UP is blocked.
        // Power reaches node1 (the corner feeding the junction's UP port) but the
        // L junction blocks UP, so the wire node1→junction must NOT render powered.
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'L' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [2]);
        // node1 (the powered feeder) is powered, junction is not.
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(false);
        // Edge 1↔2 (node→junction via UP) must be dark even though node1 is powered.
        expect(isEdgePowered(baseEdges[1], state, powered, [2])).toBe(false);
    });

    it('L junc: edge through inactive port (DOWN) is not powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'L' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // L rot=0: DOWN port inactive
        expect(isEdgePowered(baseEdges[4], state, powered, [0])).toBe(false);
    });

    it('diag junc: edge to bypassed junction through active pair (UP) is powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'diag' as const } : n)),
            baseEdges,
            1,
        );
        // diag rot=0: UP↔RIGHT, DOWN↔LEFT
        // UP neighbor (node1) is powered → UP port is effectively powered
        const powered = calculatePower(state, [0]);
        // Edge 1↔2 (node→junction via UP) — UP connected to powered node1
        expect(isEdgePowered(baseEdges[1], state, powered, [0])).toBe(true);
    });

    it('diag junc: edge from bypassed junction through inactive pair (LEFT) is not powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'diag' as const } : n)),
            baseEdges,
            1,
        );
        // diag rot=0: UP↔RIGHT, DOWN↔LEFT → LEFT pairs with DOWN, neither powered
        const powered = calculatePower(state, [0]);
        // Edge 2↔3 (junction→socket via LEFT) — LEFT port neighbor not powered
        expect(isEdgePowered(baseEdges[2], state, powered, [0])).toBe(false);
    });

    it('non-junction edge: both ends powered → powered', () => {
        const state: PuzzleState = make(
            baseNodes.map((n) => (n.kind === 'junction' ? { ...n, jType: 'T' as const } : n)),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // Edge 0↔1 (source→node) — both non-junction, both powered
        expect(isEdgePowered(baseEdges[0], state, powered, [0])).toBe(true);
    });
});

describe('regression: power flow + edge rendering', () => {
    // source → node1 → junction(at idx2) → LEFT(idx3) / RIGHT(idx4) / DOWN(idx5)
    const nodes: PuzzleNode[] = [
        { kind: 'source', x: 0, y: -24 },
        { kind: 'node', x: 0, y: -12 },
        { kind: 'junction', ring: 0, jType: 'diag', x: 0, y: 0 },
        { kind: 'node', x: -10, y: 0 }, // LEFT (plain)
        { kind: 'node', x: 10, y: 0 }, // RIGHT (plain)
        { kind: 'node', x: 0, y: 10 }, // DOWN (plain)
        { kind: 'socket', x: 20, y: 0 }, // beyond RIGHT
        { kind: 'socket', x: 0, y: 20 }, // beyond DOWN
    ];
    const edges = [
        { from: 0, fromPort: 'DOWN' as const, to: 1, toPort: 'UP' as const }, // 0
        { from: 1, fromPort: 'DOWN' as const, to: 2, toPort: 'UP' as const }, // 1
        { from: 2, fromPort: 'LEFT' as const, to: 3, toPort: 'RIGHT' as const }, // 2
        { from: 2, fromPort: 'RIGHT' as const, to: 4, toPort: 'LEFT' as const }, // 3
        { from: 2, fromPort: 'DOWN' as const, to: 5, toPort: 'UP' as const }, // 4
        { from: 4, fromPort: 'RIGHT' as const, to: 6, toPort: 'LEFT' as const }, // 5: RIGHT→socket
        { from: 5, fromPort: 'DOWN' as const, to: 7, toPort: 'UP' as const }, // 6: DOWN→socket
    ];
    const state: PuzzleState = { nodes, edges: edges as any, ringCount: 1, optimal: 0, virtualSize: 512 };

    it('diag rot=1 transmits power from RIGHT to DOWN (right→bottom pairing)', () => {
        // diag rot=1 pairs: (LEFT,UP) and (RIGHT,DOWN).
        // Power enters UP → flows to LEFT (its pair). RIGHT↔DOWN is the other pair;
        // neither side fed by source, so RIGHT and DOWN stay unpowered here.
        const left = calculatePower(state, [1]);
        expect(left.has(3)).toBe(true); // LEFT powered (paired with UP/source)
        expect(left.has(4)).toBe(false); // RIGHT not fed
        expect(left.has(5)).toBe(false); // DOWN not fed
    });

    it('diag rot=0: power UP→RIGHT continues through plain node to next edge/socket', () => {
        // diag rot=0 pairs: (UP,RIGHT) and (DOWN,LEFT). Source enters UP → RIGHT.
        const { powered, poweredEdges } = calculatePowerResult(state, [0]);
        expect(powered.has(4)).toBe(true); // RIGHT plain node powered
        expect(powered.has(6)).toBe(true); // socket beyond RIGHT powered
        // The wire feeding RIGHT must be green...
        expect(poweredEdges.has(3)).toBe(true); // edge junction→RIGHT
        // ...and the following edge from the plain RIGHT node must ALSO be green.
        expect(poweredEdges.has(5)).toBe(true); // edge RIGHT→socket
        // The isolated DOWN/LEFT pair stays dark.
        expect(poweredEdges.has(4)).toBe(false); // junction→DOWN
        expect(poweredEdges.has(6)).toBe(false); // DOWN→socket
    });

    it('diag stub render matches transmission (right↔bottom lights only when fed)', () => {
        // rot=0: UP↔RIGHT fed → that stub powered; DOWN↔LEFT not fed → dark.
        const p0 = calculatePower(state, [0]);
        expect(isJunctionStubPowered(state, 2, 'RIGHT', p0, [0])).toBe(true);
        expect(isJunctionStubPowered(state, 2, 'UP', p0, [0])).toBe(true);
        expect(isJunctionStubPowered(state, 2, 'DOWN', p0, [0])).toBe(false);
        expect(isJunctionStubPowered(state, 2, 'LEFT', p0, [0])).toBe(false);
    });

    it('T junc: edge leaving an active port to a plain node and onward is green', () => {
        const tNodes = nodes.map((n) =>
            n.kind === 'junction' ? { ...n, jType: 'T' as const } : n,
        );
        const tState: PuzzleState = { nodes: tNodes, edges: edges as any, ringCount: 1, optimal: 0, virtualSize: 512 };
        // T rot=0: UP,RIGHT,LEFT active. Power enters UP, exits RIGHT to plain node, then onward.
        const { powered, poweredEdges } = calculatePowerResult(tState, [0]);
        expect(powered.has(4)).toBe(true); // RIGHT plain
        expect(powered.has(6)).toBe(true); // socket beyond RIGHT
        expect(poweredEdges.has(3)).toBe(true); // junction→RIGHT green
        expect(poweredEdges.has(5)).toBe(true); // RIGHT→socket green (the "next edge")
        // DOWN inactive on T rot=0 → that branch dark
        expect(poweredEdges.has(4)).toBe(false);
        expect(poweredEdges.has(6)).toBe(false);
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
