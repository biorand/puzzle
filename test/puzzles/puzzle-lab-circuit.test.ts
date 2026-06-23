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
): CircuitState {
    return { nodes, edges, ringCount, optimal: 0, virtualSize: 512 };
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
        return { nodes, edges, ringCount, optimal: 0, virtualSize: 512 };
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
    const state: CircuitState = { nodes, edges, ringCount: 1, optimal: 0, virtualSize: 512 };

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
        const tState: CircuitState = { nodes: tNodes, edges, ringCount: 1, optimal: 0, virtualSize: 512 };
        const { powered, poweredEdges } = calculatePowerResult(tState, [0]);
        expect(powered.has(4)).toBe(true);
        expect(powered.has(6)).toBe(true);
        expect(poweredEdges.has(3)).toBe(true);
        expect(poweredEdges.has(5)).toBe(true);
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
