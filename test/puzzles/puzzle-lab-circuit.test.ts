import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    PuzzleLabCircuit,
    Node,
    Junction,
    Socket,
    PowerSource,
    calculatePower,
    isSolved,
    activeDirs,
    isEdgePowered,
    calculatePowerResult,
    isJunctionStubPowered,
} from '../../src/puzzles/puzzle-lab-circuit';
import type { Edge, CircuitState, JunctionType } from '../../src/puzzles/puzzle-lab-circuit';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

function makeNodes(jType: JunctionType): Node[] {
    return [
        new PowerSource(0, 0, -24, 0),
        new Node(1, 0, -12, 0),
        new Junction(2, 0, 0, 0, 0, jType),
        new Socket(3, -10, 0, 0),
        new Socket(4, 10, 0, 0),
        new Socket(5, 0, 10, 0),
    ];
}

const baseEdges: Edge[] = [
    { idx: 0, from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
    { idx: 1, from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
    { idx: 2, from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
    { idx: 3, from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
    { idx: 4, from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
];

function makeState(
    nodes: Node[],
    edges: Edge[],
    ringCount: number,
    startRotations?: number[],
): CircuitState {
    return { nodes, edges, ringCount, optimal: 0, virtualSize: 512, startRotations: startRotations ?? [] };
}

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
    it('T rot=0 at position 1: UP, RIGHT, LEFT active, DOWN excluded', () => {
        const state = makeState(
            makeNodes('T'),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        // source and power_corner always powered
        expect(powered.has(0)).toBe(true);
        expect(powered.has(1)).toBe(true);
        // junction powered (UP active)
        expect(powered.has(2)).toBe(true);
        // LEFT and RIGHT powered (nodes conduct)
        expect(powered.has(3)).toBe(true);
        expect(powered.has(4)).toBe(true);
        // DOWN excluded
        expect(powered.has(5)).toBe(false);
    });

    it('T rot=2 at position 1: UP excluded, power cannot enter', () => {
        const state = makeState(
            makeNodes('T'),
            baseEdges,
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
            makeNodes('L'),
            baseEdges,
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
            makeNodes('diag'),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [0]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(4)).toBe(true);   // RIGHT: powered via UP↔RIGHT bypass
        expect(powered.has(3)).toBe(false);  // LEFT: isolated channel
        expect(powered.has(5)).toBe(false);  // DOWN: isolated channel
    });

    it('T rot=1: UP active → LEFT and DOWN powered, RIGHT blocked', () => {
        const state = makeState(
            makeNodes('T'),
            baseEdges,
            1,
        );
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
            makeNodes('T'),
            baseEdges,
            1,
        );
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
            makeNodes('L'),
            baseEdges,
            1,
        );
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
            makeNodes('L'),
            baseEdges,
            1,
        );
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
            makeNodes('L'),
            baseEdges,
            1,
        );
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
            makeNodes('diag'),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [2]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(4)).toBe(true);   // RIGHT powered
        expect(powered.has(3)).toBe(false);  // LEFT isolated
        expect(powered.has(5)).toBe(false);  // DOWN isolated
    });

    it('Diag rot=3: LEFT↔UP pair active → LEFT powered', () => {
        const state = makeState(
            makeNodes('diag'),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [3]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(3)).toBe(true);   // LEFT powered
        expect(powered.has(4)).toBe(false);  // RIGHT isolated
        expect(powered.has(5)).toBe(false);  // DOWN isolated
    });

    it('Diag rot=1 at position 1: RIGHT↔DOWN and LEFT↔UP as separate channels', () => {
        const state = makeState(
            makeNodes('diag'),
            baseEdges,
            1,
        );
        const powered = calculatePower(state, [1]);
        expect(powered.has(2)).toBe(false);  // junction bypassed
        expect(powered.has(3)).toBe(true);   // LEFT: powered via UP↔LEFT bypass
        expect(powered.has(4)).toBe(false);  // RIGHT: isolated channel
        expect(powered.has(5)).toBe(false);  // DOWN: isolated channel
    });
});

describe('isEdgePowered', () => {
    function make(nodes: Node[], edges: Edge[], ringCount: number): CircuitState {
        return { nodes, edges, ringCount, optimal: 0, virtualSize: 512, startRotations: [] };
    }

    it('T junc: edge through active port (UP) is powered', () => {
        const state = make(makeNodes('T'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[1], state, powered, [0])).toBe(true);
    });

    it('T junc: edge through inactive port (DOWN) is not powered', () => {
        const state = make(makeNodes('T'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[4], state, powered, [0])).toBe(false);
    });

    it('T junc: edge from powered non-junction through blocked port (UP rot=2) is not powered', () => {
        const state = make(makeNodes('T'), baseEdges, 1);
        const powered = calculatePower(state, [2]);
        expect(isEdgePowered(baseEdges[1], state, powered, [2])).toBe(false);
    });

    it('T junc: edge through active port (RIGHT) is powered', () => {
        const state = make(makeNodes('T'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[3], state, powered, [0])).toBe(true);
    });

    it('L junc: edge through active port (RIGHT) is powered', () => {
        const state = make(makeNodes('L'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[3], state, powered, [0])).toBe(true);
    });

    it('L junc: edge through inactive port (LEFT) is not powered', () => {
        const state = make(makeNodes('L'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[2], state, powered, [0])).toBe(false);
    });

    it('L junc: incoming wire to a blocked port from a powered node is not powered (no leak through junction)', () => {
        const state = make(makeNodes('L'), baseEdges, 1);
        const powered = calculatePower(state, [2]);
        expect(powered.has(1)).toBe(true);
        expect(powered.has(2)).toBe(false);
        expect(isEdgePowered(baseEdges[1], state, powered, [2])).toBe(false);
    });

    it('L junc: edge through inactive port (DOWN) is not powered', () => {
        const state = make(makeNodes('L'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[4], state, powered, [0])).toBe(false);
    });

    it('diag junc: edge to bypassed junction through active pair (UP) is powered', () => {
        const state = make(makeNodes('diag'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[1], state, powered, [0])).toBe(true);
    });

    it('diag junc: edge from bypassed junction through inactive pair (LEFT) is not powered', () => {
        const state = make(makeNodes('diag'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[2], state, powered, [0])).toBe(false);
    });

    it('non-junction edge: both ends powered → powered', () => {
        const state = make(makeNodes('T'), baseEdges, 1);
        const powered = calculatePower(state, [0]);
        expect(isEdgePowered(baseEdges[0], state, powered, [0])).toBe(true);
    });
});

describe('regression: power flow + edge rendering', () => {
    const nodes: Node[] = [
        new PowerSource(0, 0, -24, 0),
        new Node(1, 0, -12, 0),
        new Junction(2, 0, 0, 0, 0, 'diag'),
        new Node(3, -10, 0, 0),
        new Node(4, 10, 0, 0),
        new Node(5, 0, 10, 0),
        new Socket(6, 20, 0, 0),
        new Socket(7, 0, 20, 0),
    ];
    const edges: Edge[] = [
        { idx: 0, from: 0, fromPort: 'DOWN', to: 1, toPort: 'UP' },
        { idx: 1, from: 1, fromPort: 'DOWN', to: 2, toPort: 'UP' },
        { idx: 2, from: 2, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
        { idx: 3, from: 2, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
        { idx: 4, from: 2, fromPort: 'DOWN', to: 5, toPort: 'UP' },
        { idx: 5, from: 4, fromPort: 'RIGHT', to: 6, toPort: 'LEFT' },
        { idx: 6, from: 5, fromPort: 'DOWN', to: 7, toPort: 'UP' },
    ];
    const state: CircuitState = { nodes, edges, ringCount: 1, optimal: 0, virtualSize: 512, startRotations: [] };

    it('diag rot=1 transmits power from RIGHT to DOWN (right→bottom pairing)', () => {
        const left = calculatePower(state, [1]);
        expect(left.has(3)).toBe(true);
        expect(left.has(4)).toBe(false);
        expect(left.has(5)).toBe(false);
    });

    it('diag rot=0: power UP→RIGHT continues through plain node to next edge/socket', () => {
        const { powered, poweredEdges } = calculatePowerResult(state, [0]);
        expect(powered.has(4)).toBe(true);
        expect(powered.has(6)).toBe(true);
        expect(poweredEdges.has(3)).toBe(true);
        expect(poweredEdges.has(5)).toBe(true);
        expect(poweredEdges.has(4)).toBe(false);
        expect(poweredEdges.has(6)).toBe(false);
    });

    it('diag stub render matches transmission (right↔bottom lights only when fed)', () => {
        const p0 = calculatePower(state, [0]);
        expect(isJunctionStubPowered(state, 2, 'RIGHT', p0, [0])).toBe(true);
        expect(isJunctionStubPowered(state, 2, 'UP', p0, [0])).toBe(true);
        expect(isJunctionStubPowered(state, 2, 'DOWN', p0, [0])).toBe(false);
        expect(isJunctionStubPowered(state, 2, 'LEFT', p0, [0])).toBe(false);
    });

    it('T junc: edge leaving an active port to a plain node and onward is green', () => {
        const tNodes = nodes.map((n) =>
            n instanceof Junction ? new Junction(n.idx, n.x, n.y, 0, n.ring, 'T') : n,
        );
        const tState: CircuitState = { nodes: tNodes, edges, ringCount: 1, optimal: 0, virtualSize: 512, startRotations: [] };
        const { powered, poweredEdges } = calculatePowerResult(tState, [0]);
        expect(powered.has(4)).toBe(true);
        expect(powered.has(6)).toBe(true);
        expect(poweredEdges.has(3)).toBe(true);
        expect(poweredEdges.has(5)).toBe(true);
        expect(poweredEdges.has(4)).toBe(false);
        expect(poweredEdges.has(6)).toBe(false);
    });
});

describe('serialized state resimulation', () => {
    // Full 3-ring circuit: power source→node→junction(T,rot=0,ring=0)
    // with junctions [4:T, 5:L, 6:L, 7:diag] on ring 0,
    // junctions [10:T, 11:T, 12:diag, 13:diag] on ring 1,
    // junctions [16:L, 17:diag, 18:diag, 19:T] on ring 2.
    // Sockets at nodes 0, 15, 20. Power source at 22.
    // All rotations = 0. Expected powered edges: {0,1,2,3,28,29}
    const nodes: Node[] = [
        new Socket(0, 0, 0, 0),
        new Node(1, 0, 0, 0),
        new Node(2, 0, 0, 0),
        new Node(3, 0, 0, 0),
        new Junction(4, 0, 0, 0, 0, 'T'),
        new Junction(5, 0, 0, 0, 0, 'L'),
        new Junction(6, 0, 0, 0, 0, 'L'),
        new Junction(7, 0, 0, 0, 0, 'diag'),
        new Node(8, 0, 0, 0),
        new Node(9, 0, 0, 0),
        new Junction(10, 0, 0, 0, 1, 'T'),
        new Junction(11, 0, 0, 0, 1, 'T'),
        new Junction(12, 0, 0, 0, 1, 'diag'),
        new Junction(13, 0, 0, 0, 1, 'diag'),
        new Node(14, 0, 0, 0),
        new Socket(15, 0, 0, 0),
        new Junction(16, 0, 0, 0, 2, 'L'),
        new Junction(17, 0, 0, 0, 2, 'diag'),
        new Junction(18, 0, 0, 0, 2, 'diag'),
        new Junction(19, 0, 0, 0, 2, 'T'),
        new Socket(20, 0, 0, 0),
        new Node(21, 0, 0, 0),
        new PowerSource(22, 0, 0, 0),
    ];

    const edges: Edge[] = [
        { idx: 0, from: 0, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
        { idx: 1, from: 7, fromPort: 'UP', to: 0, toPort: 'DOWN' },
        { idx: 2, from: 1, fromPort: 'DOWN', to: 5, toPort: 'UP' },
        { idx: 3, from: 4, fromPort: 'RIGHT', to: 1, toPort: 'LEFT' },
        { idx: 4, from: 2, fromPort: 'LEFT', to: 6, toPort: 'RIGHT' },
        { idx: 5, from: 5, fromPort: 'DOWN', to: 2, toPort: 'UP' },
        { idx: 6, from: 3, fromPort: 'UP', to: 7, toPort: 'DOWN' },
        { idx: 7, from: 6, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
        { idx: 8, from: 8, fromPort: 'RIGHT', to: 10, toPort: 'LEFT' },
        { idx: 9, from: 13, fromPort: 'UP', to: 8, toPort: 'DOWN' },
        { idx: 10, from: 9, fromPort: 'UP', to: 13, toPort: 'DOWN' },
        { idx: 11, from: 12, fromPort: 'LEFT', to: 9, toPort: 'RIGHT' },
        { idx: 12, from: 14, fromPort: 'DOWN', to: 17, toPort: 'UP' },
        { idx: 13, from: 16, fromPort: 'RIGHT', to: 14, toPort: 'LEFT' },
        { idx: 14, from: 15, fromPort: 'UP', to: 19, toPort: 'DOWN' },
        { idx: 15, from: 18, fromPort: 'LEFT', to: 15, toPort: 'RIGHT' },
        { idx: 16, from: 4, fromPort: 'DOWN', to: 10, toPort: 'UP' },
        { idx: 17, from: 5, fromPort: 'LEFT', to: 11, toPort: 'RIGHT' },
        { idx: 18, from: 6, fromPort: 'UP', to: 12, toPort: 'DOWN' },
        { idx: 19, from: 7, fromPort: 'RIGHT', to: 13, toPort: 'LEFT' },
        { idx: 20, from: 10, fromPort: 'DOWN', to: 16, toPort: 'UP' },
        { idx: 21, from: 11, fromPort: 'LEFT', to: 17, toPort: 'RIGHT' },
        { idx: 22, from: 12, fromPort: 'UP', to: 18, toPort: 'DOWN' },
        { idx: 23, from: 13, fromPort: 'RIGHT', to: 19, toPort: 'LEFT' },
        { idx: 24, from: 19, fromPort: 'RIGHT', to: 20, toPort: 'LEFT' },
        { idx: 25, from: 18, fromPort: 'UP', to: 20, toPort: 'DOWN' },
        { idx: 26, from: 17, fromPort: 'LEFT', to: 20, toPort: 'RIGHT' },
        { idx: 27, from: 16, fromPort: 'DOWN', to: 20, toPort: 'UP' },
        { idx: 28, from: 22, fromPort: 'RIGHT', to: 21, toPort: 'LEFT' },
        { idx: 29, from: 21, fromPort: 'DOWN', to: 4, toPort: 'UP' },
    ];

    const state: CircuitState = {
        nodes,
        edges,
        ringCount: 3,
        optimal: 0,
        virtualSize: 512,
        startRotations: [],
    };

    it('poweredEdges matches resimulation with all-zero rotations', () => {
        const { powered, poweredEdges } = calculatePowerResult(state, [0, 0, 0]);
        expect(poweredEdges).toMatchSnapshot();
    });
});

describe('4-ring circuit from serialized state', () => {
    // 4 rings, 32 nodes, 42 edges. Rotations: rings 0/1/2 = 0, ring 3 = 1.
    // Ring 0: junctions 4(T),5(T),6(L),7(diag)
    // Ring 1: junctions 12(L),13(diag),14(L),15(diag)
    // Ring 2: junctions 18(diag),19(diag),20(diag),21(L)
    // Ring 3: junctions 25(L),26(T),27(T),28(diag)
    // Power source 31 → node 30 → junction 4 (ring 0)
    // Center socket at 29 connected to 25, 27, 28
    // Remaining sockets at 8, 10
    const nodes: Node[] = [
        new Node(0, 0, 0, 0),
        new Node(1, 0, 0, 0),
        new Node(2, 0, 0, 0),
        new Node(3, 0, 0, 0),
        new Junction(4, 0, 0, 0, 0, 'T'),
        new Junction(5, 0, 0, 0, 0, 'T'),
        new Junction(6, 0, 0, 0, 0, 'L'),
        new Junction(7, 0, 0, 0, 0, 'diag'),
        new Socket(8, 0, 0, 0),
        new Node(9, 0, 0, 0),
        new Socket(10, 0, 0, 0),
        new Node(11, 0, 0, 0),
        new Junction(12, 0, 0, 0, 1, 'L'),
        new Junction(13, 0, 0, 0, 1, 'diag'),
        new Junction(14, 0, 0, 0, 1, 'L'),
        new Junction(15, 0, 0, 0, 1, 'diag'),
        new Node(16, 0, 0, 0),
        new Node(17, 0, 0, 0),
        new Junction(18, 0, 0, 0, 2, 'diag'),
        new Junction(19, 0, 0, 0, 2, 'diag'),
        new Junction(20, 0, 0, 0, 2, 'diag'),
        new Junction(21, 0, 0, 0, 2, 'L'),
        new Node(22, 0, 0, 0),
        new Node(23, 0, 0, 0),
        new Node(24, 0, 0, 0),
        new Junction(25, 0, 0, 0, 3, 'L'),
        new Junction(26, 0, 0, 0, 3, 'T'),
        new Junction(27, 0, 0, 0, 3, 'T'),
        new Junction(28, 0, 0, 0, 3, 'diag'),
        new Socket(29, 0, 0, 0),
        new Node(30, 0, 0, 0),
        new PowerSource(31, 0, 0, 0),
    ];

    const edges: Edge[] = [
        { idx: 0, from: 0, fromPort: 'RIGHT', to: 4, toPort: 'LEFT' },
        { idx: 1, from: 7, fromPort: 'UP', to: 0, toPort: 'DOWN' },
        { idx: 2, from: 1, fromPort: 'DOWN', to: 5, toPort: 'UP' },
        { idx: 3, from: 4, fromPort: 'RIGHT', to: 1, toPort: 'LEFT' },
        { idx: 4, from: 2, fromPort: 'LEFT', to: 6, toPort: 'RIGHT' },
        { idx: 5, from: 5, fromPort: 'DOWN', to: 2, toPort: 'UP' },
        { idx: 6, from: 3, fromPort: 'UP', to: 7, toPort: 'DOWN' },
        { idx: 7, from: 6, fromPort: 'LEFT', to: 3, toPort: 'RIGHT' },
        { idx: 8, from: 8, fromPort: 'RIGHT', to: 12, toPort: 'LEFT' },
        { idx: 9, from: 15, fromPort: 'UP', to: 8, toPort: 'DOWN' },
        { idx: 10, from: 9, fromPort: 'DOWN', to: 13, toPort: 'UP' },
        { idx: 11, from: 12, fromPort: 'RIGHT', to: 9, toPort: 'LEFT' },
        { idx: 12, from: 10, fromPort: 'LEFT', to: 14, toPort: 'RIGHT' },
        { idx: 13, from: 13, fromPort: 'DOWN', to: 10, toPort: 'UP' },
        { idx: 14, from: 11, fromPort: 'UP', to: 15, toPort: 'DOWN' },
        { idx: 15, from: 14, fromPort: 'LEFT', to: 11, toPort: 'RIGHT' },
        { idx: 16, from: 16, fromPort: 'RIGHT', to: 18, toPort: 'LEFT' },
        { idx: 17, from: 21, fromPort: 'UP', to: 16, toPort: 'DOWN' },
        { idx: 18, from: 17, fromPort: 'LEFT', to: 20, toPort: 'RIGHT' },
        { idx: 19, from: 19, fromPort: 'DOWN', to: 17, toPort: 'UP' },
        { idx: 20, from: 22, fromPort: 'RIGHT', to: 25, toPort: 'LEFT' },
        { idx: 21, from: 28, fromPort: 'UP', to: 22, toPort: 'DOWN' },
        { idx: 22, from: 23, fromPort: 'LEFT', to: 27, toPort: 'RIGHT' },
        { idx: 23, from: 26, fromPort: 'DOWN', to: 23, toPort: 'UP' },
        { idx: 24, from: 24, fromPort: 'UP', to: 28, toPort: 'DOWN' },
        { idx: 25, from: 27, fromPort: 'LEFT', to: 24, toPort: 'RIGHT' },
        { idx: 26, from: 4, fromPort: 'DOWN', to: 12, toPort: 'UP' },
        { idx: 27, from: 5, fromPort: 'LEFT', to: 13, toPort: 'RIGHT' },
        { idx: 28, from: 6, fromPort: 'UP', to: 14, toPort: 'DOWN' },
        { idx: 29, from: 7, fromPort: 'RIGHT', to: 15, toPort: 'LEFT' },
        { idx: 30, from: 12, fromPort: 'DOWN', to: 18, toPort: 'UP' },
        { idx: 31, from: 13, fromPort: 'LEFT', to: 19, toPort: 'RIGHT' },
        { idx: 32, from: 14, fromPort: 'UP', to: 20, toPort: 'DOWN' },
        { idx: 33, from: 15, fromPort: 'RIGHT', to: 21, toPort: 'LEFT' },
        { idx: 34, from: 18, fromPort: 'DOWN', to: 25, toPort: 'UP' },
        { idx: 35, from: 19, fromPort: 'LEFT', to: 26, toPort: 'RIGHT' },
        { idx: 36, from: 20, fromPort: 'UP', to: 27, toPort: 'DOWN' },
        { idx: 37, from: 21, fromPort: 'RIGHT', to: 28, toPort: 'LEFT' },
        { idx: 38, from: 25, fromPort: 'DOWN', to: 29, toPort: 'UP' },
        { idx: 39, from: 27, fromPort: 'UP', to: 29, toPort: 'DOWN' },
        { idx: 40, from: 28, fromPort: 'RIGHT', to: 29, toPort: 'LEFT' },
        { idx: 41, from: 31, fromPort: 'RIGHT', to: 30, toPort: 'LEFT' },
        { idx: 42, from: 30, fromPort: 'DOWN', to: 4, toPort: 'UP' },
    ];

    const state: CircuitState = {
        nodes,
        edges,
        ringCount: 4,
        optimal: 0,
        virtualSize: 512,
        startRotations: [],
    };

    it('poweredEdges matches resimulation with rotations [0,0,0,1]', () => {
        const { poweredEdges } = calculatePowerResult(state, [0, 0, 0, 1]);
        expect(poweredEdges).toMatchSnapshot();
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
