import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { playChime, playMelody, playTone } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { sleep } from './shared';

// ── Graph types ──
type NodeType = 'power' | 'socket' | 'junction' | 'node';
type Dir = 'T' | 'R' | 'B' | 'L';
type JunctionType = 'T' | 'L' | 'diag';

interface GNode {
    id: string;
    type: NodeType;
    x: number;
    y: number;
    r: number;
    jType?: JunctionType;
}
interface GEdge {
    id: string;
    a: string;
    aDir: Dir;
    b: string;
    bDir: Dir;
}
interface CircuitGraph {
    nodes: GNode[];
    edges: GEdge[];
    receivers: string[];
    ringCount: number;
    optimal: number;
}

const RING_COUNT_MIN = 3,
    RING_COUNT_MAX = 4;
const RECEIVER_MIN = 2,
    RECEIVER_MAX = 6;
const CONN_POS = [1, 3, 5, 7],
    CORNER_POS = [0, 2, 4, 6];
const RING_BAND = 12,
    RING_GAP = 10;
const JUNC_RADIUS = 7,
    RECEIVER_RADIUS = 9;
const BOARD_PAD = 10,
    SCALE = 0.8125,
    MAX_R = 4;

const BASE_JUNC: Record<JunctionType, [number, number][]> = {
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
const PORTS = ['I', 'A', 'O', 'B'];
const JUNC_TYPES: JunctionType[] = ['T', 'L', 'diag'];

// Port → direction per junction position
const PORT_DIR: Record<number, Record<string, Dir>> = {
    1: { I: 'B', A: 'R', O: 'T', B: 'L' },
    3: { I: 'L', A: 'B', O: 'R', B: 'T' },
    5: { I: 'T', A: 'L', O: 'B', B: 'R' },
    7: { I: 'R', A: 'T', O: 'L', B: 'B' },
};

function junctionConnectedDirs(pos: number, type: JunctionType, rot: number): Dir[] {
    const dirs = new Set<Dir>();
    for (const [a, b] of BASE_JUNC[type]) {
        dirs.add(PORT_DIR[pos][PORTS[(a - rot + 4) % 4]]);
        dirs.add(PORT_DIR[pos][PORTS[(b - rot + 4) % 4]]);
    }
    return [...dirs];
}
function edgePoint(n: GNode, dir: Dir): { x: number; y: number } {
    switch (dir) {
        case 'T':
            return { x: n.x, y: n.y - n.r };
        case 'B':
            return { x: n.x, y: n.y + n.r };
        case 'L':
            return { x: n.x - n.r, y: n.y };
        case 'R':
            return { x: n.x + n.r, y: n.y };
    }
}

interface ConnectorDef {
    type: JunctionType;
}
interface PuzzleState {
    ringCount: number;
    segments: number[];
    connectors: ConnectorDef[][];
    receivers: string[];
}
// portNeighbor is used by the e2e test's inline solver
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function portNeighbor(ring: number, cpos: number, port: string, ringCount: number): string {
    switch (port) {
        case 'A':
            return `${ring},${(cpos + 1) % 8}`;
        case 'B':
            return `${ring},${(cpos + 7) % 8}`;
        case 'I':
            return ring >= ringCount - 1 ? 'center' : `${ring + 1},${cpos}`;
        case 'O':
            return ring <= 0 ? 'source' : `${ring - 1},${cpos}`;
    }
    return '';
}
function connectedPairs(type: JunctionType, rot: number): [string, string][] {
    return BASE_JUNC[type].map(([a, b]) => [PORTS[(a - rot + 4) % 4], PORTS[(b - rot + 4) % 4]]);
}

function calculatePower(state: PuzzleState, rots: number[]): Set<string> {
    const { ringCount, segments, connectors } = state;
    const adj = new Map<string, string[]>();
    function ae(a: string, b: string) {
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a)!.push(b);
        adj.get(b)!.push(a);
    }

    // Helper: does junction at (r, cpos) connect a specific port?
    function juncHasPort(r: number, cpos: number, port: string): boolean {
        for (let ci = 0; ci < 4; ci++) {
            if (CONN_POS[ci] === cpos) {
                for (const [p1, p2] of connectedPairs(connectors[r][ci].type, rots[r])) {
                    if (p1 === port || p2 === port) return true;
                }
                return false;
            }
        }
        return false;
    }

    // For each junction, add edges from the junction position to each
    // connected port's neighbor. Power must flow THROUGH the junction node.
    for (let r = 0; r < ringCount; r++) {
        for (let ci = 0; ci < 4; ci++) {
            const cpos = CONN_POS[ci];
            const pairs = connectedPairs(connectors[r][ci].type, rots[r]);
            const connectedPorts = new Set<string>();
            for (const [p1, p2] of pairs) {
                connectedPorts.add(p1);
                connectedPorts.add(p2);
            }

            for (const port of connectedPorts) {
                if (port === 'A') {
                    // Clockwise ring edge — segment must exist
                    if (segments[r] & (1 << cpos)) {
                        ae(`${r},${cpos}`, `${r},${(cpos + 1) % 8}`);
                    }
                } else if (port === 'B') {
                    // Counterclockwise ring edge — segment must exist
                    const segBit = (cpos + 7) % 8;
                    if (segments[r] & (1 << segBit)) {
                        ae(`${r},${cpos}`, `${r},${segBit}`);
                    }
                } else if (port === 'I') {
                    // Inward edge
                    if (r >= ringCount - 1) {
                        ae(`${r},${cpos}`, 'center');
                    } else {
                        // Bidirectional: inner junction must also connect O
                        if (juncHasPort(r + 1, cpos, 'O')) {
                            ae(`${r},${cpos}`, `${r + 1},${cpos}`);
                        }
                    }
                } else if (port === 'O') {
                    // Outward edge
                    if (r <= 0) {
                        // Connect to source — this is how power enters the circuit
                        ae(`${r},${cpos}`, 'source');
                    } else {
                        // Bidirectional: outer junction must also connect I
                        if (juncHasPort(r - 1, cpos, 'I')) {
                            ae(`${r},${cpos}`, `${r - 1},${cpos}`);
                        }
                    }
                }
            }
        }
    }

    if (!adj.has('center')) adj.set('center', []);
    if (!adj.has('source')) adj.set('source', []);

    // BFS from source
    const visited = new Set<string>();
    const queue = ['source'];
    visited.add('source');
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const nb of adj.get(cur) || [])
            if (!visited.has(nb)) {
                visited.add(nb);
                queue.push(nb);
            }
    }
    return visited;
}
function solveOptimal(state: PuzzleState): number[] | null {
    const R = state.ringCount,
        total = 1 << (2 * R);
    let best: number[] | null = null,
        bestT = Infinity;
    for (let i = 0; i < total; i++) {
        const rots: number[] = [];
        let tmp = i,
            clicks = 0;
        for (let r = 0; r < R; r++) {
            rots.push(tmp & 3);
            clicks += tmp & 3;
            tmp >>= 2;
        }
        if (clicks >= bestT) continue;
        const p = calculatePower(state, rots);
        let ok = true;
        for (const r of state.receivers)
            if (!p.has(r)) {
                ok = false;
                break;
            }
        if (ok) {
            bestT = clicks;
            best = rots;
        }
    }
    return best;
}
function isSolved(state: PuzzleState, powered: Set<string>): boolean {
    for (const r of state.receivers) if (!powered.has(r)) return false;
    return true;
}
function generatePuzzleState(): PuzzleState | null {
    for (let att = 0; att < 200; att++) {
        const rc = (RING_COUNT_MIN + Math.random() * (RING_COUNT_MAX - RING_COUNT_MIN + 1)) | 0;
        const segs: number[] = [],
            conns: ConnectorDef[][] = [];
        for (let r = 0; r < rc; r++) {
            let m = 0;
            for (let p = 0; p < 8; p++) if (Math.random() < 0.7) m |= 1 << p;
            if (bitCount(m) < 4) m = 0b11111111;
            for (const cp of [0, 2, 4, 6]) {
                const a = (cp + 7) % 8,
                    b = cp;
                if (!(m & (1 << a)) && !(m & (1 << b))) m |= 1 << (Math.random() < 0.5 ? a : b);
            }
            segs.push(m);
            const rc2: ConnectorDef[] = [];
            for (let ci = 0; ci < 4; ci++) rc2.push({ type: JUNC_TYPES[(Math.random() * 3) | 0] });
            conns.push(rc2);
        }
        const forced: string[] = [],
            optional: string[] = [];
        for (let r = 0; r < rc; r++)
            for (const cp of CORNER_POS)
                (((segs[r] >> ((cp + 7) % 8)) & 1) + ((segs[r] >> cp) & 1) <= 1
                    ? forced
                    : optional
                ).push(`${r},${cp}`);
        const target = (RECEIVER_MIN + Math.random() * (RECEIVER_MAX - RECEIVER_MIN + 1)) | 0;
        const remain = Math.max(0, target - forced.length);
        const extra = shuffle(optional).slice(0, Math.min(remain, optional.length));
        const receivers = [...forced, ...extra, 'center'];
        const s: PuzzleState = { ringCount: rc, segments: segs, connectors: conns, receivers };
        if (isSolved(s, calculatePower(s, new Array(rc).fill(0)))) continue;
        const opt = solveOptimal(s);
        if (!opt || opt.reduce((a, b) => a + b, 0) <= 0) continue;
        return s;
    }
    return null;
}
function bitCount(n: number): number {
    let c = 0;
    while (n) {
        c += n & 1;
        n >>>= 1;
    }
    return c;
}
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function hashPuzzle(s: PuzzleState): string {
    return JSON.stringify(s);
}

function buildGraph(
    state: PuzzleState,
    rotations: number[],
    scale: number,
    size: number,
): CircuitGraph {
    const { ringCount, segments, connectors, receivers: rcvrList } = state;
    const nodes: GNode[] = [],
        edges: GEdge[] = [];
    const cx = size / 2,
        cy = size / 2;
    const recvSet = new Set(rcvrList);
    let eidC = 0;
    function eid(): string {
        return `e${eidC++}`;
    }
    function ringPts(ring: number) {
        const hw = (MAX_R - ring) * (RING_BAND + RING_GAP) * scale;
        const x0 = cx - hw,
            y0 = cy - hw,
            w = hw * 2;
        return [
            { x: x0, y: y0 },
            { x: x0 + w / 2, y: y0 },
            { x: x0 + w, y: y0 },
            { x: x0 + w, y: y0 + w / 2 },
            { x: x0 + w, y: y0 + w },
            { x: x0 + w / 2, y: y0 + w },
            { x: x0, y: y0 + w },
            { x: x0, y: y0 + w / 2 },
        ];
    }
    function dT(f: { x: number; y: number }, t: { x: number; y: number }): Dir {
        const dx = t.x - f.x,
            dy = t.y - f.y;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'B' : 'T';
    }
    for (let r = 0; r < ringCount; r++) {
        const pts = ringPts(r);
        for (const cp of CORNER_POS) {
            const id = `${r},${cp}`;
            nodes.push({
                id,
                type: recvSet.has(id) ? 'socket' : 'node',
                x: pts[cp].x,
                y: pts[cp].y,
                r: recvSet.has(id) ? RECEIVER_RADIUS : 3,
            });
        }
        for (let ci = 0; ci < 4; ci++) {
            const cpos = CONN_POS[ci];
            nodes.push({
                id: `j${r}_${cpos}`,
                type: 'junction',
                x: pts[cpos].x,
                y: pts[cpos].y,
                r: JUNC_RADIUS,
                jType: connectors[r][ci].type,
            });
        }
    }
    nodes.push(
        { id: 'center', type: 'socket', x: cx, y: cy, r: RECEIVER_RADIUS },
        { id: 'power', type: 'power', x: BOARD_PAD, y: BOARD_PAD, r: 8 },
    );
    for (let r = 0; r < ringCount; r++) {
        const pts = ringPts(r);
        for (let p = 0; p < 8; p++) {
            if (!(segments[r] & (1 << p))) continue;
            const np = (p + 1) % 8,
                idA = CONN_POS.includes(p) ? `j${r}_${p}` : `${r},${p}`,
                idB = CONN_POS.includes(np) ? `j${r}_${np}` : `${r},${np}`;
            edges.push({
                id: eid(),
                a: idA,
                aDir: dT(pts[p], pts[np]),
                b: idB,
                bDir: dT(pts[np], pts[p]),
            });
        }
    }
    for (let r = 0; r < ringCount - 1; r++) {
        const oPts = ringPts(r),
            iPts = ringPts(r + 1);
        for (let ci = 0; ci < 4; ci++) {
            const cpos = CONN_POS[ci];
            edges.push({
                id: eid(),
                a: `j${r}_${cpos}`,
                aDir: dT(oPts[cpos], iPts[cpos]),
                b: `j${r + 1}_${cpos}`,
                bDir: dT(iPts[cpos], oPts[cpos]),
            });
        }
    }
    const iPts = ringPts(ringCount - 1);
    for (let ci = 0; ci < 4; ci++) {
        const cpos = CONN_POS[ci];
        edges.push({
            id: eid(),
            a: `j${ringCount - 1}_${cpos}`,
            aDir: dT(iPts[cpos], { x: cx, y: cy }),
            b: 'center',
            bDir: dT({ x: cx, y: cy }, iPts[cpos]),
        });
    }
    const rvrs: string[] = ['center'];
    for (let r = 0; r < ringCount; r++)
        for (const cp of CORNER_POS) if (recvSet.has(`${r},${cp}`)) rvrs.push(`${r},${cp}`);
    // Power → outer ring top-mid (j0_1) with 90° corner
    // Power → outer ring top-mid (j0_1) with 90° corner
    // Corner at same X as junction, Y aligned with power box center
    const jPt = ringPts(0)[1];
    const cornerId = 'power_corner';
    nodes.push({ id: cornerId, type: 'node', x: jPt.x, y: BOARD_PAD, r: 0 });
    edges.push({ id: eid(), a: 'power', aDir: 'R', b: cornerId, bDir: 'L' });
    edges.push({ id: eid(), a: cornerId, aDir: 'B', b: 'j0_1', bDir: 'T' });

    const opt = solveOptimal(state);
    return {
        nodes,
        edges,
        receivers: rvrs,
        ringCount,
        optimal: opt ? opt.reduce((a, b) => a + b, 0) : 0,
    };
}

const CO = '#22cc44',
    CD = '#1a4a2a',
    CX = '#333';

export class PuzzleLabCircuit extends LitElement implements PuzzleLitElement {
    private static _lastHash = '';
    @state() private _moves = 0;
    @state() private _optimal = 0;
    @state() private _playing = false;
    @state() private _rotations: number[] = [];
    @state() private _powered: Set<string> = new Set();
    private _graph: CircuitGraph | null = null;
    private _rawState: PuzzleState | null = null;
    private _canvas!: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _completionAnimating = false;
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
        let state: PuzzleState | null = null,
            hash = '';
        do {
            state = generatePuzzleState();
            hash = hashPuzzle(state!);
        } while (hash === PuzzleLabCircuit._lastHash);
        PuzzleLabCircuit._lastHash = hash;
        this._rawState = state!;
        this._rotations = new Array(state!.ringCount).fill(0);
        this._moves = 0;
        const opt = solveOptimal(state!);
        this._optimal = opt ? opt.reduce((a, b) => a + b, 0) : 0;
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
    private _calcScale(sz: number): number {
        return ((sz - 2 * BOARD_PAD) / 2 / (MAX_R * (RING_BAND + RING_GAP))) * SCALE;
    }
    private _simulateAndRender(): void {
        if (!this._rawState) return;
        const sz = this._getCanvasSize();
        this._graph = buildGraph(this._rawState, this._rotations, this._calcScale(sz), sz);
        // Use calculatePower — matches solver
        this._powered = calculatePower(this._rawState, this._rotations);
        this.requestUpdate();
    }
    private _onCanvasReady(_e: Event): void {
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
            const nA = this._graph.nodes.find((n) => n.id === e.a),
                nB = this._graph.nodes.find((n) => n.id === e.b);
            if (!nA || !nB) continue;
            const p1 = edgePoint(nA, e.aDir),
                p2 = edgePoint(nB, e.bDir);
            // Edge powered if either endpoint is in powered set
            const isP = this._isGraphNodePowered(nA.id) || this._isGraphNodePowered(nB.id);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isP ? CO : CD;
            ctx.lineWidth = isP ? 2.5 : 1.5;
            if (isP) {
                ctx.shadowColor = CO;
                ctx.shadowBlur = 6;
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
                    ctx.fillStyle = isP ? CO : '#555';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowBlur = isP ? 6 : 0;
                    ctx.shadowColor = CO;
                    ctx.fillText('⚡', n.x, n.y);
                    ctx.shadowBlur = 0;
                    break;
                }
                case 'junction': {
                    const m = n.id.match(/^j(\d+)_(\d+)$/);
                    const ring = m ? +m[1] : -1;
                    const isHovered = ring >= 0 && ring === this._hoveredRing;
                    ctx.fillStyle = isP ? '#1a3a2a' : '#1a1a1a';
                    ctx.strokeStyle = isHovered ? '#66ff99' : isP ? CO : CX;
                    ctx.lineWidth = (isP ? 2 : 1) + (isHovered ? 2 : 0);
                    ctx.shadowBlur = isHovered ? 12 : isP ? 6 : 0;
                    ctx.shadowColor = '#66ff99';
                    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
                    ctx.strokeRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
                    ctx.shadowBlur = 0;
                    // Draw junction lines
                    if (m) {
                        const dirs = junctionConnectedDirs(+m[2], n.jType!, this._rotations[ring]);
                        if (n.jType === 'diag') {
                            // Diag: two non-crossing diagonal lines in opposite quadrants
                            // Pair 0 = dirs[0]↔dirs[1], Pair 1 = dirs[2]↔dirs[3]
                            for (let p = 0; p < 2; p++) {
                                const dirA = dirs[p * 2],
                                    dirB = dirs[p * 2 + 1];
                                const dxA = dirA === 'R' ? 1 : dirA === 'L' ? -1 : 0;
                                const dyA = dirA === 'B' ? 1 : dirA === 'T' ? -1 : 0;
                                const dxB = dirB === 'R' ? 1 : dirB === 'L' ? -1 : 0;
                                const dyB = dirB === 'B' ? 1 : dirB === 'T' ? -1 : 0;
                                const len = n.r * 0.65;
                                const off = (p === 0 ? 1 : -1) * n.r * 0.2;
                                ctx.beginPath();
                                ctx.moveTo(n.x + dxA * len + off, n.y + dyA * len + off);
                                ctx.lineTo(n.x + dxB * len + off, n.y + dyB * len + off);
                                ctx.strokeStyle = isP ? CO : CD;
                                ctx.lineWidth = isHovered ? 3 : isP ? 2.5 : 1.5;
                                ctx.shadowBlur = isHovered ? 8 : isP ? 6 : 0;
                                ctx.shadowColor = '#66ff99';
                                ctx.stroke();
                                ctx.shadowBlur = 0;
                            }
                        } else {
                            // T / L: draw lines from center toward each connected port
                            for (const dir of dirs) {
                                const dx = dir === 'R' ? 1 : dir === 'L' ? -1 : 0;
                                const dy = dir === 'B' ? 1 : dir === 'T' ? -1 : 0;
                                ctx.beginPath();
                                ctx.moveTo(n.x, n.y);
                                ctx.lineTo(n.x + dx * n.r * 0.75, n.y + dy * n.r * 0.75);
                                ctx.strokeStyle = isP ? CO : CD;
                                ctx.lineWidth = isHovered ? 3 : isP ? 2.5 : 1.5;
                                ctx.shadowBlur = isHovered ? 8 : isP ? 6 : 0;
                                ctx.shadowColor = '#66ff99';
                                ctx.stroke();
                                ctx.shadowBlur = 0;
                            }
                        }
                    }
                    break;
                }
                case 'power':
                    ctx.fillStyle = '#1a3a2a';
                    ctx.strokeStyle = CO;
                    ctx.lineWidth = 1.5;
                    ctx.fillRect(BOARD_PAD, BOARD_PAD, 62, 16);
                    ctx.strokeRect(BOARD_PAD, BOARD_PAD, 62, 16);
                    ctx.fillStyle = CO;
                    ctx.shadowColor = CO;
                    ctx.shadowBlur = 4;
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('POWER', BOARD_PAD + 31, BOARD_PAD + 8);
                    ctx.shadowBlur = 0;
                    break;
            }
        }
        const total = this._graph.receivers.length;
        let count = 0;
        for (const r of this._graph.receivers) if (this._powered.has(r)) count++;
        ctx.fillStyle = CO;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 10;
        ctx.shadowColor = CO;
        ctx.fillText(`⚡ ${count}/${total}`, size - BOARD_PAD, BOARD_PAD);
        ctx.shadowBlur = 0;
    }
    // Map graph node IDs to legacy IDs for powered set lookup
    private _isGraphNodePowered(graphId: string): boolean {
        if (graphId === 'power') return true;
        if (graphId === 'center') return this._powered.has('center');
        if (graphId.startsWith('j')) {
            // j{ring}_{pos} → {ring},{pos}
            return this._powered.has(graphId.substring(1).replace('_', ','));
        }
        return this._powered.has(graphId);
    }

    private _hoveredRing = -1;

    private _onCanvasMove(e: MouseEvent): void {
        if (!this._graph || !this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        const x = e.clientX - rect.left,
            y = e.clientY - rect.top;
        let foundRing = -1;
        for (const n of this._graph.nodes) {
            if (n.type !== 'junction') continue;
            if ((x - n.x) ** 2 + (y - n.y) ** 2 <= (n.r * 2) ** 2) {
                const m = n.id.match(/^j(\d+)_(\d+)$/);
                if (m) {
                    foundRing = +m[1];
                    break;
                }
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
        this._rotateRing(this._hoveredRing);
    }
    private _rotateRing(ring: number): void {
        if (this._playing || this._completionAnimating) return;
        this._rotations = this._rotations.map((r, i) => (i === ring ? (r + 1) % 4 : r));
        this._moves++;
        playTone(Math.min(this._moves / Math.max(this._optimal, 1), 1));
        this._simulateAndRender();
        if (this._rawState && isSolved(this._rawState, this._legacyPowered()))
            setTimeout(() => this._completePuzzle(), 400);
    }
    private _legacyPowered(): Set<string> {
        const p = new Set<string>();
        if (!this._graph) return p;
        for (const n of this._graph.nodes)
            if (n.type === 'socket' && this._powered.has(n.id)) p.add(n.id);
        return p;
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
