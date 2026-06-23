import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { playChime, playMelody, playTone } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { sleep } from './shared';

type Dir = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

interface BaseNode {
    x: number;
    y: number;
}
interface JunctionNode extends BaseNode {
    kind: 'junction';
    ring: number;
    jType: 'T' | 'L' | 'diag';
}
interface ReceiverNode extends BaseNode {
    kind: 'receiver';
}
interface SourceNode extends BaseNode {
    kind: 'source';
}
interface PlainNode extends BaseNode {
    kind: 'node';
}
export type PuzzleNode = JunctionNode | ReceiverNode | SourceNode | PlainNode;

interface Edge {
    from: number;
    fromPort: Dir;
    to: number;
    toPort: Dir;
}

export interface PuzzleState {
    nodes: PuzzleNode[];
    edges: Edge[];
    ringCount: number;
    optimal: number;
}

// ── Visual graph types (used by rendering) ──

type NodeType = 'power' | 'socket' | 'junction' | 'node';
type JunctionType = 'T' | 'L' | 'diag';

interface GNode {
    id: string;
    type: NodeType;
    x: number;
    y: number;
    r: number;
    ring?: number;
    jType?: JunctionType;
}
interface GEdge {
    id: string;
    idx: number;
    a: string;
    aDir: Dir;
    b: string;
    bDir: Dir;
}
interface CircuitGraph {
    nodes: GNode[];
    edges: GEdge[];
    receivers: number[];
    ringCount: number;
    optimal: number;
}

// ── Constants ──

const PORT_ORDER: Dir[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
const BASE_CONN: Record<string, [number, number][]> = {
    T: [
        [0, 1],
        [0, 3],
        [1, 3],
    ],
    L: [[0, 1]],
    diag: [
        [0, 1],
        [2, 3],
    ],
};
const RING_BAND = 12;
const RING_GAP = 14;
const BOARD_PAD = 10;
const SCALE = 0.8125;
const MAX_R = 4;
const JUNC_RADIUS = (RING_BAND + RING_GAP) / 3;
const RECEIVER_RADIUS = 9;
const RING_COUNT_MIN = 2;
const RING_COUNT_MAX = 4;
const RECEIVER_MIN = 2;
const RECEIVER_MAX = 6;
const CONN_POS = [1, 3, 5, 7];
const CORNER_POS = [0, 2, 4, 6];
const JUNC_TYPES: JunctionType[] = ['T', 'L', 'diag'];

// ── Helpers ──

function dirBetween(a: { x: number; y: number }, b: { x: number; y: number }): Dir {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
}

export function activeDirs(jType: string, rot: number): Dir[] {
    const set = new Set<Dir>();
    for (const [a, b] of BASE_CONN[jType]) {
        set.add(PORT_ORDER[(a - rot + 4) % 4]);
        set.add(PORT_ORDER[(b - rot + 4) % 4]);
    }
    return [...set];
}

function activePairs(jType: string, rot: number): [Dir, Dir][] {
    return BASE_CONN[jType].map(([a, b]) => [
        PORT_ORDER[(a - rot + 4) % 4],
        PORT_ORDER[(b - rot + 4) % 4],
    ]);
}

function portCoord(n: { x: number; y: number; r: number }, dir: Dir): { x: number; y: number } {
    switch (dir) {
        case 'UP':
            return { x: n.x, y: n.y - n.r };
        case 'DOWN':
            return { x: n.x, y: n.y + n.r };
        case 'LEFT':
            return { x: n.x - n.r, y: n.y };
        case 'RIGHT':
            return { x: n.x + n.r, y: n.y };
    }
}

function ringPositions(ring: number): { x: number; y: number }[] {
    const hw = (MAX_R - ring) * (RING_BAND + RING_GAP);
    return [
        { x: -hw, y: -hw },
        { x: 0, y: -hw },
        { x: hw, y: -hw },
        { x: hw, y: 0 },
        { x: hw, y: hw },
        { x: 0, y: hw },
        { x: -hw, y: hw },
        { x: -hw, y: 0 },
    ];
}

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── Core simulation ──

// Result of a full power simulation: which nodes are energized, and which
// original (physical) edges actually carry power. The edge set is the single
// source of truth used by rendering so the visuals always match the logic.
export interface PowerResult {
    powered: Set<number>;
    poweredEdges: Set<number>;
    visitedEdges: Set<number>;
}

// For a diag junction, return the partner direction of `dir` under `rot`
// (the other end of the internal pair the port belongs to), or null.
function diagPartnerDir(rot: number, dir: Dir): Dir | null {
    for (const [a, b] of activePairs('diag', rot)) {
        if (a === dir) return b;
        if (b === dir) return a;
    }
    return null;
}

// Decide whether a junction's physical stub in direction `dir` conducts power,
// given the final powered-node set. For diag this depends on its pairing.
function junctionStubConducts(
    nodeIdx: number,
    node: JunctionNode,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
    portMap: Map<string, number[]>,
): boolean {
    if (node.jType !== 'diag') {
        // T/L hub: the stub conducts iff the junction is energized and the
        // port is one of the active ports of the hub.
        return powered.has(nodeIdx) && activeDirs(node.jType, rots[node.ring]).includes(dir);
    }
    // diag: the stub on `dir` belongs to a pair (dir, partner). The pair channel
    // is energized iff a neighbor on either end of the pair is powered.
    const partner = diagPartnerDir(rots[node.ring], dir);
    const onDir = portMap.get(`${nodeIdx},${dir}`) || [];
    if (onDir.some((nb) => powered.has(nb))) return true;
    if (partner) {
        const onPartner = portMap.get(`${nodeIdx},${partner}`) || [];
        if (onPartner.some((nb) => powered.has(nb))) return true;
    }
    return false;
}

// Whether one endpoint of an edge conducts power into/out of the edge.
function endpointConducts(
    nodeIdx: number,
    node: PuzzleNode,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
    portMap: Map<string, number[]>,
): boolean {
    if (node.kind !== 'junction') {
        return powered.has(nodeIdx);
    }
    return junctionStubConducts(nodeIdx, node, dir, powered, rots, portMap);
}

function buildPortMap(state: PuzzleState): Map<string, number[]> {
    const portMap = new Map<string, number[]>();
    for (const e of state.edges) {
        const ka = `${e.from},${e.fromPort}`;
        if (!portMap.has(ka)) portMap.set(ka, []);
        portMap.get(ka)!.push(e.to);
        const kb = `${e.to},${e.toPort}`;
        if (!portMap.has(kb)) portMap.set(kb, []);
        portMap.get(kb)!.push(e.from);
    }
    return portMap;
}

export function isEdgePowered(
    edge: Edge,
    state: PuzzleState,
    powered: Set<number>,
    rots: number[],
): boolean {
    const portMap = buildPortMap(state);
    return (
        endpointConducts(
            edge.from,
            state.nodes[edge.from],
            edge.fromPort,
            powered,
            rots,
            portMap,
        ) && endpointConducts(edge.to, state.nodes[edge.to], edge.toPort, powered, rots, portMap)
    );
}

// Whether a junction's internal stub in a given direction should render as
// energized. Used by the canvas to keep junction graphics consistent with the
// physical-edge power state.
export function isJunctionStubPowered(
    state: PuzzleState,
    nodeIdx: number,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
): boolean {
    const node = state.nodes[nodeIdx];
    if (node.kind !== 'junction') return false;
    return junctionStubConducts(nodeIdx, node, dir, powered, rots, buildPortMap(state));
}

export function calculatePowerResult(state: PuzzleState, rots: number[]): PowerResult {
    const adj = new Map<number, Set<number>>();
    for (let i = 0; i < state.nodes.length; i++) adj.set(i, new Set());
    for (const e of state.edges) {
        adj.get(e.from)!.add(e.to);
        adj.get(e.to)!.add(e.from);
    }

    const portMap = buildPortMap(state);

    const edgeMap = new Map<string, Edge>();
    for (const e of state.edges) {
        edgeMap.set(`${e.from},${e.to}`, e);
        edgeMap.set(`${e.to},${e.from}`, e);
    }

    for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i];
        if (n.kind !== 'junction') continue;
        if (n.jType === 'diag') {
            // Diag: wire neighbors of each active pair directly, bypass junction
            const pairs = activePairs(n.jType, rots[n.ring]);
            for (const [dirA, dirB] of pairs) {
                const neighborsA = portMap.get(`${i},${dirA}`) || [];
                const neighborsB = portMap.get(`${i},${dirB}`) || [];
                for (const na of neighborsA) {
                    for (const nb of neighborsB) {
                        if (na === nb) continue;
                        adj.get(na)!.add(nb);
                        adj.get(nb)!.add(na);
                    }
                }
            }
            // Remove junction from graph entirely
            const ns = [...(adj.get(i) || [])];
            for (const j of ns) {
                adj.get(i)!.delete(j);
                adj.get(j)!.delete(i);
            }
        } else {
            // T/L: hub-based — keep edges through junction for active ports
            const active = activeDirs(n.jType, rots[n.ring]);
            const neighbors = [...(adj.get(i) || [])];
            for (const j of neighbors) {
                const e = edgeMap.get(`${i},${j}`);
                if (!e) continue; // synthesized by diag bypass
                const port = e.from === i ? e.fromPort : e.toPort;
                if (!active.includes(port)) {
                    adj.get(i)!.delete(j);
                    adj.get(j)!.delete(i);
                }
            }
        }
    }

    const sourceIdx = state.nodes.findIndex((n) => n.kind === 'source');
    const powered = new Set<number>();
    if (sourceIdx >= 0) {
        const queue = [sourceIdx];
        powered.add(sourceIdx);
        while (queue.length) {
            const cur = queue.shift()!;
            for (const nb of adj.get(cur) || []) {
                if (!powered.has(nb)) {
                    powered.add(nb);
                    queue.push(nb);
                }
            }
        }
    }

    // Derive powered physical edges from the final node set. An edge carries
    // power iff both of its endpoints conduct into the wire.
    const poweredEdges = new Set<number>();
    for (let ei = 0; ei < state.edges.length; ei++) {
        const e = state.edges[ei];
        const a = endpointConducts(e.from, state.nodes[e.from], e.fromPort, powered, rots, portMap);
        const b = endpointConducts(e.to, state.nodes[e.to], e.toPort, powered, rots, portMap);
        if (a && b) poweredEdges.add(ei);
    }

    // Visited edges: power reaches at least one endpoint. This includes edges
    // where the far side is a junction with a blocked port — the wire itself is
    // energized even if the junction can't pass the power through.
    const visitedEdges = new Set<number>();
    for (let ei = 0; ei < state.edges.length; ei++) {
        const e = state.edges[ei];
        const a = endpointConducts(e.from, state.nodes[e.from], e.fromPort, powered, rots, portMap);
        const b = endpointConducts(e.to, state.nodes[e.to], e.toPort, powered, rots, portMap);
        if (a || b) visitedEdges.add(ei);
    }

    return { powered, poweredEdges, visitedEdges };
}

export function calculatePower(state: PuzzleState, rots: number[]): Set<number> {
    return calculatePowerResult(state, rots).powered;
}

function solveOptimal(state: PuzzleState): number[] | null {
    const R = state.ringCount;
    const total = 1 << (2 * R);
    let best: number[] | null = null;
    let bestT = Infinity;
    for (let i = 0; i < total; i++) {
        const rots: number[] = [];
        let tmp = i;
        let clicks = 0;
        for (let r = 0; r < R; r++) {
            rots.push(tmp & 3);
            clicks += tmp & 3;
            tmp >>= 2;
        }
        if (clicks >= bestT) continue;
        const p = calculatePower(state, rots);
        let ok = true;
        for (let ni = 0; ni < state.nodes.length; ni++) {
            if (state.nodes[ni].kind === 'receiver' && !p.has(ni)) {
                ok = false;
                break;
            }
        }
        if (ok) {
            bestT = clicks;
            best = rots;
        }
    }
    return best;
}

export function isSolved(state: PuzzleState, powered: Set<number>): boolean {
    for (let i = 0; i < state.nodes.length; i++) {
        if (state.nodes[i].kind === 'receiver' && !powered.has(i)) return false;
    }
    return true;
}

function hashPuzzle(s: PuzzleState): string {
    return JSON.stringify({ nodes: s.nodes, edges: s.edges, ringCount: s.ringCount });
}

// ── Puzzle generation ──

function generatePuzzleState(): PuzzleState | null {
    for (let att = 0; att < 200; att++) {
        const rc = (RING_COUNT_MIN + Math.random() * (RING_COUNT_MAX - RING_COUNT_MIN + 1)) | 0;
        const nodes: PuzzleNode[] = [];
        const edges: Edge[] = [];
        const idxMap = new Map<string, number>();

        for (let r = 0; r < rc; r++) {
            const pos = ringPositions(r);
            for (const cp of CORNER_POS) {
                const i = nodes.length;
                nodes.push({ kind: 'node', x: pos[cp].x, y: pos[cp].y });
                idxMap.set(`${r},${cp}`, i);
            }
            for (let ci = 0; ci < 4; ci++) {
                const cpos = CONN_POS[ci];
                const jType = JUNC_TYPES[(Math.random() * 3) | 0];
                const i = nodes.length;
                nodes.push({
                    kind: 'junction',
                    ring: r,
                    jType,
                    x: pos[cpos].x,
                    y: pos[cpos].y,
                });
                idxMap.set(`${r},${cpos}`, i);
            }
        }

        const centerIdx = nodes.length;
        nodes.push({ kind: 'receiver', x: 0, y: 0 });

        const r0p0 = ringPositions(0)[0];
        const r0p1 = ringPositions(0)[1];
        const cornerNodeIdx = nodes.length;
        const sourceIdx = nodes.length + 1;
        nodes.push(
            { kind: 'node', x: r0p1.x, y: r0p0.y - 16 },
            { kind: 'source', x: r0p0.x, y: r0p0.y - 16 },
        );

        // Ring segments
        for (let r = 0; r < rc; r++) {
            for (let p = 0; p < 8; p++) {
                const np = (p + 1) % 8;
                const aIdx = idxMap.get(`${r},${p}`)!;
                const bIdx = idxMap.get(`${r},${np}`)!;
                edges.push({
                    from: aIdx,
                    fromPort: dirBetween(nodes[aIdx], nodes[bIdx]),
                    to: bIdx,
                    toPort: dirBetween(nodes[bIdx], nodes[aIdx]),
                });
            }
        }

        // Inter-ring
        for (let r = 0; r < rc - 1; r++) {
            for (const cpos of CONN_POS) {
                const aIdx = idxMap.get(`${r},${cpos}`)!;
                const bIdx = idxMap.get(`${r + 1},${cpos}`)!;
                edges.push({
                    from: aIdx,
                    fromPort: dirBetween(nodes[aIdx], nodes[bIdx]),
                    to: bIdx,
                    toPort: dirBetween(nodes[bIdx], nodes[aIdx]),
                });
            }
        }

        // Center connections (2-4 of the innermost CONN_POS, variable count)
        const shuffledConn = shuffle([...CONN_POS]);
        const centerConnCount = 2 + ((Math.random() * 3) | 0); // 2-4
        const centerConns = shuffledConn.slice(0, centerConnCount);
        for (const cpos of centerConns) {
            const jIdx = idxMap.get(`${rc - 1},${cpos}`)!;
            edges.push({
                from: jIdx,
                fromPort: dirBetween(nodes[jIdx], nodes[centerIdx]),
                to: centerIdx,
                toPort: dirBetween(nodes[centerIdx], nodes[jIdx]),
            });
        }

        // Source → power_corner → ring 0 position 1 (top-middle connector)
        edges.push(
            {
                from: sourceIdx,
                fromPort: dirBetween(nodes[sourceIdx], nodes[cornerNodeIdx]),
                to: cornerNodeIdx,
                toPort: dirBetween(nodes[cornerNodeIdx], nodes[sourceIdx]),
            },
            {
                from: cornerNodeIdx,
                fromPort: dirBetween(nodes[cornerNodeIdx], nodes[idxMap.get('0,1')!]),
                to: idxMap.get('0,1')!,
                toPort: dirBetween(nodes[idxMap.get('0,1')!], nodes[cornerNodeIdx]),
            },
        );

        // Promote corners to receivers
        const cornerIdxs = CORNER_POS.flatMap((cp) =>
            Array.from({ length: rc }, (_, r) => idxMap.get(`${r},${cp}`)!),
        );
        const target = (RECEIVER_MIN + Math.random() * (RECEIVER_MAX - RECEIVER_MIN + 1)) | 0;
        const selected = new Set(shuffle(cornerIdxs).slice(0, Math.min(target, cornerIdxs.length)));
        selected.add(centerIdx);
        for (const i of selected) {
            const n = nodes[i]!;
            nodes[i] = { kind: 'receiver', x: n.x, y: n.y };
        }

        const state: PuzzleState = { nodes, edges, ringCount: rc, optimal: 0 };
        if (isSolved(state, calculatePower(state, new Array(rc).fill(0)))) continue;
        const opt = solveOptimal(state);
        if (!opt || opt.reduce((a, b) => a + b, 0) <= 0) continue;
        state.optimal = opt.reduce((a, b) => a + b, 0);
        return state;
    }
    return null;
}

// ── Build visual graph ──

function buildGraph(state: PuzzleState, size: number): CircuitGraph {
    const { nodes: pNodes, edges: pEdges, ringCount } = state;
    const cx = size / 2;
    const cy = size / 2;
    const baseHw = MAX_R * (RING_BAND + RING_GAP);
    const scale = ((size - 2 * BOARD_PAD) / 2 / baseHw) * SCALE;
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];
    let eidC = 0;
    const eid = () => `e${eidC++}`;

    for (let i = 0; i < pNodes.length; i++) {
        const n = pNodes[i];
        const gx = cx + n.x * scale;
        const gy = cy + n.y * scale;
        let type: NodeType;
        let r: number;
        switch (n.kind) {
            case 'junction':
                type = 'junction';
                r = JUNC_RADIUS;
                break;
            case 'receiver':
                type = 'socket';
                r = RECEIVER_RADIUS;
                break;
            case 'source':
                type = 'power';
                r = 8;
                break;
            case 'node':
                type = 'node';
                r = 3;
                break;
        }
        nodes.push({
            id: String(i),
            type,
            x: gx,
            y: gy,
            r,
            ring: n.kind === 'junction' ? n.ring : undefined,
            jType: n.kind === 'junction' ? n.jType : undefined,
        });
    }

    for (let ei = 0; ei < pEdges.length; ei++) {
        const e = pEdges[ei];
        edges.push({
            id: eid(),
            idx: ei,
            a: String(e.from),
            aDir: e.fromPort,
            b: String(e.to),
            bDir: e.toPort,
        });
    }

    const receivers: number[] = [];
    for (let i = 0; i < pNodes.length; i++) {
        if (pNodes[i].kind === 'receiver') receivers.push(i);
    }

    return { nodes, edges, receivers, ringCount, optimal: state.optimal };
}

// ── Render colors ──

const CO = '#14812d';
const CD = '#0f3d1e';
const CX = '#333';

// ── Lit Element ──

export class PuzzleLabCircuit extends LitElement implements PuzzleLitElement {
    private static _lastHash = '';

    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _playing = false;
    @state() private _rotations: number[] = [];
    @state() private _powered: Set<number> = new Set();
    @state() private _poweredEdges: Set<number> = new Set();

    private _graph: CircuitGraph | null = null;
    private _rawState: PuzzleState | null = null;
    private _canvas!: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _completionAnimating = false;
    private _hoveredRing = -1;

    createRenderRoot() {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
        this._generatePuzzle();
        this._dispatchActions();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener(PUZZLE_REGENERATE, this._onRegenerate as EventListener);
    }

    regenerate(): void {
        this._generatePuzzle();
        this._dispatchActions();
    }

    private _onRegenerate(): void {
        this.regenerate();
    }

    private _generatePuzzle(): void {
        let state: PuzzleState | null = null;
        let hash = '';
        do {
            state = generatePuzzleState();
            hash = hashPuzzle(state!);
        } while (hash === PuzzleLabCircuit._lastHash);
        PuzzleLabCircuit._lastHash = hash;
        this._rawState = state!;
        this._rotations = new Array(state!.ringCount).fill(0);
        this._moves = 0;
        this._optimal = state!.optimal;
        this._playing = false;
        this._completionAnimating = false;
        this._simulateAndRender();
        this._dispatchStatus();
    }

    private _resetPuzzle(): void {
        if (!this._rawState) return;
        this._rotations = new Array(this._rawState.ringCount).fill(0);
        this._moves = 0;
        this._playing = false;
        this._completionAnimating = false;
        this._simulateAndRender();
        this._dispatchStatus();
    }

    private _getCanvasSize(): number {
        return this._canvas
            ? Math.min(
                this._canvas.getBoundingClientRect().width,
                this._canvas.getBoundingClientRect().height,
            )
            : 400;
    }

    _calculatePower(state: PuzzleState, rots: number[]): Set<number> {
        return calculatePower(state, rots);
    }

    private _simulateAndRender(): void {
        if (!this._rawState) return;
        const sz = this._getCanvasSize();
        this._graph = buildGraph(this._rawState, sz);
        const result = calculatePowerResult(this._rawState, this._rotations);
        this._powered = result.powered;
        this._poweredEdges = result.visitedEdges;
        this.requestUpdate();
    }

    private _onCanvasReady(e: Event): void {
        this._canvas = e.target as HTMLCanvasElement;
        this._ctx = this._canvas.getContext('2d');
        this._drawCanvas();
    }

    private _drawCanvas(): void {
        const c = this._canvas;
        if (!c || !this._ctx || !this._graph) return;
        const ctx = this._ctx;
        const dpr = window.devicePixelRatio || 1;
        const rect = c.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        c.width = size * dpr;
        c.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        for (const e of this._graph.edges) {
            const nA = this._graph.nodes[+e.a];
            const nB = this._graph.nodes[+e.b];
            if (!nA || !nB) continue;
            const p1 = portCoord(nA, e.aDir);
            const p2 = portCoord(nB, e.bDir);
            const isP = this._isEdgePowered(e);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isP ? CO : CD;
            ctx.lineWidth = isP ? 2.5 : 1.5;
            if (isP) {
                ctx.shadowColor = CO;
                ctx.shadowBlur = 4;
            } else {
                ctx.setLineDash([4, 4]);
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }

        for (const n of this._graph.nodes) {
            const isP = this._isGraphNodePowered(n.id);
            switch (n.type) {
                case 'node':
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                    ctx.fillStyle = isP ? CO : CX;
                    ctx.fill();
                    break;
                case 'socket': {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                    ctx.strokeStyle = isP ? CO : '#555';
                    ctx.lineWidth = isP ? 2.5 : 1.5;
                    ctx.shadowBlur = isP ? 10 : 0;
                    ctx.shadowColor = CO;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = CO;
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowBlur = isP ? 6 : 0;
                    ctx.shadowColor = CO;
                    ctx.fillText('⚡', n.x, n.y);
                    ctx.shadowBlur = 0;
                    break;
                }
                case 'junction': {
                    const ring = n.ring!;
                    const isHovered = ring >= 0 && ring === this._hoveredRing;
                    ctx.fillStyle = isP ? '#1a3a2a' : '#1a1a1a';
                    ctx.strokeStyle = isHovered ? '#48b46c' : isP ? CO : CX;
                    ctx.lineWidth = (isP ? 2 : 1);
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = '#48b46c';
                    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
                    ctx.strokeRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
                    ctx.shadowBlur = 0;
                    if (n.jType === 'diag') {
                        const pairs = activePairs(n.jType, this._rotations[ring]);
                        const jIdx = +n.id;
                        for (const [dirA, dirB] of pairs) {
                            const pa = portCoord(n, dirA);
                            const pb = portCoord(n, dirB);
                            const pairPowered =
                                !!this._rawState &&
                                isJunctionStubPowered(
                                    this._rawState,
                                    jIdx,
                                    dirA,
                                    this._powered,
                                    this._rotations,
                                );
                            ctx.beginPath();
                            ctx.moveTo(pa.x, pa.y);
                            ctx.lineTo(pb.x, pb.y);
                            ctx.strokeStyle = pairPowered ? CO : CD;
                            ctx.lineWidth = 1.5;
                            if (pairPowered) {
                                ctx.shadowColor = CO;
                            }
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        }
                    } else {
                        const jIdx = +n.id;
                        const dirs = activeDirs(n.jType!, this._rotations[ring]);
                        for (const dir of dirs) {
                            const stubP =
                                !!this._rawState &&
                                isJunctionStubPowered(
                                    this._rawState,
                                    jIdx,
                                    dir,
                                    this._powered,
                                    this._rotations,
                                );
                            const pt = portCoord(n, dir);
                            const dx = pt.x - n.x;
                            const dy = pt.y - n.y;
                            const mag = Math.abs(dx) + Math.abs(dy);
                            ctx.beginPath();
                            ctx.moveTo(n.x, n.y);
                            ctx.lineTo(
                                n.x + (dx / mag) * n.r * 0.75,
                                n.y + (dy / mag) * n.r * 0.75,
                            );
                            ctx.strokeStyle = stubP ? CO : CD;
                            ctx.lineWidth = 1.5;
                            ctx.shadowBlur = 0;
                            ctx.shadowColor = '#66ff99';
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        }
                    }
                    break;
                }
                case 'power':
                    ctx.fillStyle = '#0f3d1e';
                    ctx.strokeStyle = CO;
                    ctx.lineWidth = 1.5;
                    ctx.fillRect(n.x - 28, n.y - 8, 56, 16);
                    ctx.strokeRect(n.x - 28, n.y - 8, 56, 16);
                    ctx.fillStyle = CO;
                    ctx.shadowColor = CO;
                    ctx.shadowBlur = 1;
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('POWER', n.x, n.y);
                    ctx.shadowBlur = 0;
                    break;
            }
        }

        const total = this._graph.receivers.length;
        let count = 0;
        for (const r of this._graph.receivers) if (this._powered.has(r)) count++;
        ctx.fillStyle = CO;
        ctx.font = '14px "Noto Sans Symbols"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 10;
        ctx.shadowColor = CO;
        ctx.fillText(`⚡ ${count}/${total}`, size - BOARD_PAD, BOARD_PAD);
        ctx.shadowBlur = 0;
    }

    private _isGraphNodePowered(graphId: string): boolean {
        return this._powered.has(+graphId);
    }

    private _isEdgePowered(e: GEdge): boolean {
        return this._poweredEdges.has(e.idx);
    }

    private _onCanvasMove(e: MouseEvent): void {
        if (!this._graph || !this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let foundRing = -1;
        for (const n of this._graph.nodes) {
            if (n.type !== 'junction' || n.ring === undefined) continue;
            if ((x - n.x) ** 2 + (y - n.y) ** 2 <= (n.r * 2) ** 2) {
                foundRing = n.ring;
                break;
            }
        }
        if (foundRing !== this._hoveredRing) {
            this._hoveredRing = foundRing;
            this._canvas.style.cursor = foundRing >= 0 ? 'pointer' : '';
            this._drawCanvas();
        }
    }

    private _onCanvasLeave(): void {
        if (this._hoveredRing >= 0) {
            this._hoveredRing = -1;
            this._canvas.style.cursor = '';
            this._drawCanvas();
        }
    }

    private _onCanvasClick(_e: MouseEvent): void {
        if (this._playing || this._completionAnimating || !this._graph || !this._canvas) return;
        if (this._hoveredRing < 0) return;
        if (this._rawState && isSolved(this._rawState, this._powered)) return;
        this._rotateRing(this._hoveredRing);
    }

    private _rotateRing(ring: number): void {
        if (this._playing || this._completionAnimating) return;
        this._rotations = this._rotations.map((r, i) => (i === ring ? (r + 1) % 4 : r));
        this._moves++;
        playTone(Math.min(this._moves / Math.max(this._optimal, 1), 1));
        this._simulateAndRender();
        this._dispatchStatus();
        if (this._rawState && isSolved(this._rawState, this._powered))
            setTimeout(() => this._completePuzzle(), 400);
    }

    private async _completePuzzle(): Promise<void> {
        this._playing = true;
        this._completionAnimating = true;
        this._dispatchActions();
        playChime();
        const mel = playMelody('F4/4 A4/4 C5/4 F5/4 E5/4 D5/4 C5/4');
        for (let f = 0; f < 4; f++) {
            if (this._canvas)
                this._canvas.style.filter = f % 2 === 0 ? 'brightness(1.4)' : 'brightness(1)';
            await sleep(200);
        }
        if (this._canvas) this._canvas.style.filter = '';
        await mel;
        this._completionAnimating = false;
        this.dispatchEvent(new CustomEvent(PUZZLE_COMPLETE, { bubbles: true, composed: true }));
    }

    private _dispatchStatus(): void {
        this.dispatchEvent(
            new CustomEvent(PUZZLE_STATUS, {
                detail: { moves: this._moves, optimal: this._optimal },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _dispatchActions(): void {
        const b: ActionButton[] = this._playing
            ? []
            : [
                {
                    label: 'New Puzzle',
                    handler: () => {
                        if (!this._playing) this._generatePuzzle();
                    },
                },
                {
                    label: 'Reset',
                    handler: () => {
                        if (!this._playing) this._resetPuzzle();
                    },
                },
            ];
        this.dispatchEvent(
            new CustomEvent(PUZZLE_ACTIONS, { detail: b, bubbles: true, composed: true }),
        );
    }

    render() {
        return html`<div id="lab-circuit-wrap">
            <canvas
                id="lab-circuit-canvas"
                @click=${this._onCanvasClick}
                @mousemove=${this._onCanvasMove}
                @mouseleave=${this._onCanvasLeave}
                @canvas-ready=${this._onCanvasReady}
            ></canvas>
        </div>`;
    }

    updated(): void {
        if (!this._canvas) {
            this._canvas = this.querySelector('#lab-circuit-canvas') as HTMLCanvasElement;
            if (this._canvas) {
                try {
                    this._ctx = this._canvas.getContext('2d');
                } catch {
                    /* ignore */
                }
                this._observeResize();
            }
        }
        if (this._ctx) this._drawCanvas();
    }

    private _resizeObs: ResizeObserver | null = null;

    private _observeResize(): void {
        if (this._resizeObs) return;
        const wrap = this.querySelector('#lab-circuit-wrap');
        if (!wrap) return;
        if (typeof ResizeObserver === 'undefined') {
            this._drawCanvas();
            return;
        }
        this._resizeObs = new ResizeObserver(() => this._drawCanvas());
        this._resizeObs.observe(wrap);
    }
}

customElements.define('puzzle-lab-circuit', PuzzleLabCircuit);

declare global {
    interface HTMLElementTagNameMap {
        'puzzle-lab-circuit': PuzzleLabCircuit;
    }
}
