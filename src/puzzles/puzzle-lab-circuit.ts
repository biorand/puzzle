import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { playChime, playMelody, playTone } from '../audio';
import type { ActionButton, PuzzleLitElement } from '../types';
import { PUZZLE_ACTIONS, PUZZLE_COMPLETE, PUZZLE_REGENERATE, PUZZLE_STATUS } from '../types';
import { sleep } from './shared';

type Dir = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';
type JunctionType = 'T' | 'L' | 'diag';

interface BaseNode {
    x: number;
    y: number;
}
interface JunctionNode extends BaseNode {
    kind: 'junction';
    ring: number;
    jType: JunctionType;
}
interface SocketNode extends BaseNode {
    kind: 'socket';
}
interface SourceNode extends BaseNode {
    kind: 'source';
}
interface PlainNode extends BaseNode {
    kind: 'node';
}
export type PuzzleNode = JunctionNode | SocketNode | SourceNode | PlainNode;

export interface PuzzleEdge {
    from: number;
    fromPort: Dir;
    to: number;
    toPort: Dir;
}

export interface PuzzleState {
    nodes: PuzzleNode[];
    edges: PuzzleEdge[];
    ringCount: number;
    optimal: number;
    virtualSize: number;
}

export interface Edge {
    id: string;
    idx: number;
    a: string;
    aDir: Dir;
    b: string;
    bDir: Dir;
}

export interface DrawContext {
    hoveredRing: number;
    rotations: number[];
    rawState: PuzzleState | null;
    powered: Set<number>;
}

export interface CircuitGraph {
    nodes: Node[];
    edges: Edge[];
    sockets: number[];
    ringCount: number;
    optimal: number;
}

export interface PowerResult {
    powered: Set<number>;
    poweredEdges: Set<number>;
    visitedEdges: Set<number>;
}

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
const MAX_R = 4;
const RING_COUNT_MIN = 2;
const RING_COUNT_MAX = 4;
const SOCKET_MIN = 2;
const SOCKET_MAX = 6;
const CONN_POS = [1, 3, 5, 7];
const CORNER_POS = [0, 2, 4, 6];
const JUNC_TYPES: JunctionType[] = ['T', 'L', 'diag'];
const PAD_RATIO = 24 / 512;
const NODE_RADIUS_RATIO = 1 / 512;
const JUNC_RADIUS_RATIO = 12 / 512;
const SOCKET_RADIUS_RATIO = 10 / 512;
const POWER_RADIUS_RATIO = 20 / 512;

// ── Pure helpers ──

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

function diagPartnerDir(rot: number, dir: Dir): Dir | null {
    for (const [a, b] of activePairs('diag', rot)) {
        if (a === dir) return b;
        if (b === dir) return a;
    }
    return null;
}

function junctionStubConducts(
    nodeIdx: number,
    jType: JunctionType,
    ring: number,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
    portMap: Map<string, number[]>,
): boolean {
    if (jType !== 'diag') {
        return powered.has(nodeIdx) && activeDirs(jType, rots[ring]).includes(dir);
    }
    const partner = diagPartnerDir(rots[ring], dir);
    const onDir = portMap.get(`${nodeIdx},${dir}`) || [];
    if (onDir.some((nb) => powered.has(nb))) return true;
    if (partner) {
        const onPartner = portMap.get(`${nodeIdx},${partner}`) || [];
        if (onPartner.some((nb) => powered.has(nb))) return true;
    }
    return false;
}

function endpointConducts(
    nodeIdx: number,
    node: PuzzleNode,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
    portMap: Map<string, number[]>,
): boolean {
    if (node.kind !== 'junction') return powered.has(nodeIdx);
    return junctionStubConducts(nodeIdx, node.jType, node.ring, dir, powered, rots, portMap);
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

// ── Node class hierarchy ──

export class Node {
    protected _portPadding = 0;

    constructor(
        public idx: number,
        public x: number,
        public y: number,
        public radius: number,
    ) { }

    portCoord(dir: Dir, padding?: number): { x: number; y: number } {
        const r = this.radius + (padding ?? this._portPadding);
        switch (dir) {
            case 'UP':
                return { x: this.x, y: this.y - r };
            case 'DOWN':
                return { x: this.x, y: this.y + r };
            case 'LEFT':
                return { x: this.x - r, y: this.y };
            case 'RIGHT':
                return { x: this.x + r, y: this.y };
        }
    }

    conductsPower(
        _dir: Dir,
        powered: Set<number>,
        _rots: number[],
        _portMap: Map<string, number[]>,
    ): boolean {
        return powered.has(this.idx);
    }

    draw(ctx: CanvasRenderingContext2D, dctx: DrawContext): void {
        const isP = dctx.powered.has(this.idx);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = isP ? '#14812d' : '#333';
        ctx.fill();
    }
}

export class Junction extends Node {
    constructor(
        idx: number,
        x: number,
        y: number,
        radius: number,
        public ring: number,
        public jType: JunctionType,
    ) {
        super(idx, x, y, radius);
        this._portPadding = 4;
    }

    conductsPower(
        dir: Dir,
        powered: Set<number>,
        rots: number[],
        portMap: Map<string, number[]>,
    ): boolean {
        return junctionStubConducts(this.idx, this.jType, this.ring, dir, powered, rots, portMap);
    }

    draw(ctx: CanvasRenderingContext2D, dctx: DrawContext): void {
        const isP = dctx.powered.has(this.idx);
        const isHovered = dctx.hoveredRing === this.ring;
        ctx.fillStyle = isP ? '#1a3a2a' : '#1a1a1a';
        ctx.strokeStyle = isHovered ? '#48b46c' : isP ? '#14812d' : '#333';
        ctx.lineWidth = isP ? 2 : 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = '#48b46c';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.strokeRect(
            this.x - this.radius,
            this.y - this.radius,
            this.radius * 2,
            this.radius * 2,
        );
        ctx.shadowBlur = 0;

        if (this.jType === 'diag') {
            const pairs = activePairs(this.jType, dctx.rotations[this.ring]);
            for (const [dirA, dirB] of pairs) {
                const pa = this.portCoord(dirA, -2);
                const pb = this.portCoord(dirB, -2);
                const pairPowered =
                    !!dctx.rawState &&
                    isJunctionStubPowered(
                        dctx.rawState,
                        this.idx,
                        dirA,
                        dctx.powered,
                        dctx.rotations,
                    );
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(pb.x, pb.y);
                ctx.strokeStyle = pairPowered ? '#14812d' : '#0f3d1e';
                ctx.lineWidth = 1.5;
                if (pairPowered) ctx.shadowColor = '#14812d';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        } else {
            const dirs = activeDirs(this.jType, dctx.rotations[this.ring]);
            for (const dir of dirs) {
                const stubP =
                    !!dctx.rawState &&
                    isJunctionStubPowered(
                        dctx.rawState,
                        this.idx,
                        dir,
                        dctx.powered,
                        dctx.rotations,
                    );
                const pt = this.portCoord(dir, 0);
                const dx = pt.x - this.x;
                const dy = pt.y - this.y;
                const mag = Math.abs(dx) + Math.abs(dy);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(
                    this.x + (dx / mag) * this.radius * 0.75,
                    this.y + (dy / mag) * this.radius * 0.75,
                );
                ctx.strokeStyle = stubP ? '#14812d' : '#0f3d1e';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 0;
                ctx.shadowColor = '#66ff99';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }
}

export class Socket extends Node {
    constructor(idx: number, x: number, y: number, radius: number) {
        super(idx, x, y, radius);
        this._portPadding = 4;
    }

    draw(ctx: CanvasRenderingContext2D, dctx: DrawContext): void {
        const isP = dctx.powered.has(this.idx);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = isP ? '#14812d' : '#555';
        ctx.lineWidth = isP ? 2.5 : 1.5;
        ctx.shadowBlur = isP ? 10 : 0;
        ctx.shadowColor = '#14812d';
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#14812d';
        ctx.font = `${Math.round(this.radius * 1)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = isP ? 6 : 0;
        ctx.shadowColor = '#14812d';
        ctx.fillText('\u26a1', this.x, this.y + 1);
        ctx.shadowBlur = 0;
    }
}

export class PowerSource extends Node {
    constructor(idx: number, x: number, y: number, radius: number) {
        super(idx, x, y, radius);
    }

    draw(ctx: CanvasRenderingContext2D, _dctx: DrawContext): void {
        ctx.fillStyle = '#0f3d1e';
        ctx.strokeStyle = '#14812d';
        ctx.lineWidth = 1.5;
        ctx.fillRect(
            this.x - this.radius,
            this.y - this.radius * 0.5,
            this.radius * 2,
            this.radius,
        );
        ctx.strokeRect(
            this.x - this.radius,
            this.y - this.radius * 0.5,
            this.radius * 2,
            this.radius,
        );
        ctx.fillStyle = '#14812d';
        ctx.shadowColor = '#14812d';
        ctx.shadowBlur = 1;
        ctx.font = `bold ${Math.round(this.radius * 0.6)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('POWER', this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

// ── Core simulation ──

function buildAdjacency(state: PuzzleState): Map<number, Set<number>> {
    const adj = new Map<number, Set<number>>();
    for (let i = 0; i < state.nodes.length; i++) adj.set(i, new Set());
    for (const e of state.edges) {
        adj.get(e.from)!.add(e.to);
        adj.get(e.to)!.add(e.from);
    }
    return adj;
}

function buildEdgeMap(state: PuzzleState): Map<string, PuzzleEdge> {
    const m = new Map<string, PuzzleEdge>();
    for (const e of state.edges) {
        m.set(`${e.from},${e.to}`, e);
        m.set(`${e.to},${e.from}`, e);
    }
    return m;
}

function applyJunctionRewiring(
    state: PuzzleState,
    rots: number[],
    adj: Map<number, Set<number>>,
    portMap: Map<string, number[]>,
    edgeMap: Map<string, PuzzleEdge>,
): void {
    for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i];
        if (n.kind !== 'junction') continue;
        if (n.jType === 'diag') {
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
            const ns = [...(adj.get(i) || [])];
            for (const j of ns) {
                adj.get(i)!.delete(j);
                adj.get(j)!.delete(i);
            }
        } else {
            const active = activeDirs(n.jType, rots[n.ring]);
            const neighbors = [...(adj.get(i) || [])];
            for (const j of neighbors) {
                const e = edgeMap.get(`${i},${j}`);
                if (!e) continue;
                const port = e.from === i ? e.fromPort : e.toPort;
                if (!active.includes(port)) {
                    adj.get(i)!.delete(j);
                    adj.get(j)!.delete(i);
                }
            }
        }
    }
}

function bfsPowered(sourceIdx: number, adj: Map<number, Set<number>>): Set<number> {
    const powered = new Set<number>();
    if (sourceIdx < 0) return powered;
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
    return powered;
}

function deriveEdges(
    state: PuzzleState,
    powered: Set<number>,
    rots: number[],
    portMap: Map<string, number[]>,
): { poweredEdges: Set<number>; visitedEdges: Set<number> } {
    const poweredEdges = new Set<number>();
    const visitedEdges = new Set<number>();
    for (let ei = 0; ei < state.edges.length; ei++) {
        const e = state.edges[ei];
        const a = endpointConducts(e.from, state.nodes[e.from], e.fromPort, powered, rots, portMap);
        const b = endpointConducts(e.to, state.nodes[e.to], e.toPort, powered, rots, portMap);
        if (a && b) poweredEdges.add(ei);
        if (a || b) visitedEdges.add(ei);
    }
    return { poweredEdges, visitedEdges };
}

export function calculatePowerResult(state: PuzzleState, rots: number[]): PowerResult {
    const adj = buildAdjacency(state);
    const portMap = buildPortMap(state);
    const edgeMap = buildEdgeMap(state);

    applyJunctionRewiring(state, rots, adj, portMap, edgeMap);

    const sourceIdx = state.nodes.findIndex((n) => n.kind === 'source');
    const powered = bfsPowered(sourceIdx, adj);

    const { poweredEdges, visitedEdges } = deriveEdges(state, powered, rots, portMap);
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
            if (state.nodes[ni].kind === 'socket' && !p.has(ni)) {
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
        if (state.nodes[i].kind === 'socket' && !powered.has(i)) return false;
    }
    return true;
}

export function isEdgePowered(
    edge: PuzzleEdge,
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

export function isJunctionStubPowered(
    state: PuzzleState,
    nodeIdx: number,
    dir: Dir,
    powered: Set<number>,
    rots: number[],
): boolean {
    const node = state.nodes[nodeIdx];
    if (node.kind !== 'junction') return false;
    return junctionStubConducts(
        nodeIdx,
        node.jType,
        node.ring,
        dir,
        powered,
        rots,
        buildPortMap(state),
    );
}

// ── Puzzle generation ──

export class PuzzleGenerator {
    private rc = 0;
    private nodes: PuzzleNode[] = [];
    private edges: PuzzleEdge[] = [];
    private idxMap = new Map<string, number>();

    generate(virtualSize: number): PuzzleState | null {
        const pad = Math.round(virtualSize * PAD_RATIO);

        for (let att = 0; att < 200; att++) {
            this.rc = (RING_COUNT_MIN + Math.random() * (RING_COUNT_MAX - RING_COUNT_MIN + 1)) | 0;
            this.nodes = [];
            this.edges = [];
            this.idxMap.clear();

            this._createRings();
            const centerIdx = this._createCenter();
            const [sourceIdx, cornerNodeIdx] = this._createPowerNodes();
            this._wireRingSegments();
            this._wireInterRing();
            this._wireCenter(centerIdx);
            this._wirePower(sourceIdx, cornerNodeIdx);
            this._promoteSockets(centerIdx);
            this._scaleCoords(virtualSize, pad);

            const state: PuzzleState = {
                nodes: this.nodes,
                edges: this.edges,
                ringCount: this.rc,
                optimal: 0,
                virtualSize,
            };
            if (isSolved(state, calculatePower(state, new Array(this.rc).fill(0)))) continue;
            const opt = solveOptimal(state);
            if (!opt || opt.reduce((a, b) => a + b, 0) <= 0) continue;
            state.optimal = opt.reduce((a, b) => a + b, 0);
            return state;
        }
        return null;
    }

    private _createRings(): void {
        for (let r = 0; r < this.rc; r++) {
            const pos = ringPositions(r);
            for (const cp of CORNER_POS) {
                const i = this.nodes.length;
                this.nodes.push({ kind: 'node', x: pos[cp].x, y: pos[cp].y });
                this.idxMap.set(`${r},${cp}`, i);
            }
            for (let ci = 0; ci < 4; ci++) {
                const cpos = CONN_POS[ci];
                const jType = JUNC_TYPES[(Math.random() * 3) | 0];
                const i = this.nodes.length;
                this.nodes.push({
                    kind: 'junction',
                    ring: r,
                    jType,
                    x: pos[cpos].x,
                    y: pos[cpos].y,
                });
                this.idxMap.set(`${r},${cpos}`, i);
            }
        }
    }

    private _createCenter(): number {
        const i = this.nodes.length;
        this.nodes.push({ kind: 'socket', x: 0, y: 0 });
        return i;
    }

    private _createPowerNodes(): [number, number] {
        const r0p0 = ringPositions(0)[0];
        const r0p1 = ringPositions(0)[1];
        const cornerNodeIdx = this.nodes.length;
        const sourceIdx = this.nodes.length + 1;
        this.nodes.push(
            { kind: 'node', x: r0p1.x, y: r0p0.y - 16 },
            { kind: 'source', x: r0p0.x, y: r0p0.y - 16 },
        );
        return [sourceIdx, cornerNodeIdx];
    }

    private _wireRingSegments(): void {
        for (let r = 0; r < this.rc; r++) {
            for (let p = 0; p < 8; p++) {
                const np = (p + 1) % 8;
                const aIdx = this.idxMap.get(`${r},${p}`)!;
                const bIdx = this.idxMap.get(`${r},${np}`)!;
                this.edges.push({
                    from: aIdx,
                    fromPort: dirBetween(this.nodes[aIdx], this.nodes[bIdx]),
                    to: bIdx,
                    toPort: dirBetween(this.nodes[bIdx], this.nodes[aIdx]),
                });
            }
        }
    }

    private _wireInterRing(): void {
        for (let r = 0; r < this.rc - 1; r++) {
            for (const cpos of CONN_POS) {
                const aIdx = this.idxMap.get(`${r},${cpos}`)!;
                const bIdx = this.idxMap.get(`${r + 1},${cpos}`)!;
                this.edges.push({
                    from: aIdx,
                    fromPort: dirBetween(this.nodes[aIdx], this.nodes[bIdx]),
                    to: bIdx,
                    toPort: dirBetween(this.nodes[bIdx], this.nodes[aIdx]),
                });
            }
        }
    }

    private _wireCenter(centerIdx: number): void {
        const shuffledConn = shuffle([...CONN_POS]);
        const centerConnCount = 2 + ((Math.random() * 3) | 0);
        const centerConns = shuffledConn.slice(0, centerConnCount);
        for (const cpos of centerConns) {
            const jIdx = this.idxMap.get(`${this.rc - 1},${cpos}`)!;
            this.edges.push({
                from: jIdx,
                fromPort: dirBetween(this.nodes[jIdx], this.nodes[centerIdx]),
                to: centerIdx,
                toPort: dirBetween(this.nodes[centerIdx], this.nodes[jIdx]),
            });
        }
    }

    private _wirePower(sourceIdx: number, cornerNodeIdx: number): void {
        const r0p1 = this.idxMap.get('0,1')!;
        this.edges.push(
            {
                from: sourceIdx,
                fromPort: dirBetween(this.nodes[sourceIdx], this.nodes[cornerNodeIdx]),
                to: cornerNodeIdx,
                toPort: dirBetween(this.nodes[cornerNodeIdx], this.nodes[sourceIdx]),
            },
            {
                from: cornerNodeIdx,
                fromPort: dirBetween(this.nodes[cornerNodeIdx], this.nodes[r0p1]),
                to: r0p1,
                toPort: dirBetween(this.nodes[r0p1], this.nodes[cornerNodeIdx]),
            },
        );
    }

    private _promoteSockets(centerIdx: number): void {
        const cornerIdxs = CORNER_POS.flatMap((cp) =>
            Array.from({ length: this.rc }, (_, r) => this.idxMap.get(`${r},${cp}`)!),
        );
        const target = (SOCKET_MIN + Math.random() * (SOCKET_MAX - SOCKET_MIN + 1)) | 0;
        const selected = new Set(shuffle(cornerIdxs).slice(0, Math.min(target, cornerIdxs.length)));
        selected.add(centerIdx);
        for (const i of selected) {
            const n = this.nodes[i]!;
            this.nodes[i] = { kind: 'socket', x: n.x, y: n.y };
        }
    }

    private _scaleCoords(virtualSize: number, pad: number): void {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const n of this.nodes) {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        }
        const modelW = maxX - minX || 1;
        const modelH = maxY - minY || 1;
        const modelMax = Math.max(modelW, modelH);
        const available = virtualSize - 2 * pad;
        const s = available / modelMax;
        const cw = modelW * s;
        const ch = modelH * s;
        const ox = (virtualSize - cw) / 2 - minX * s;
        const oy = (virtualSize - ch) / 2 - minY * s;
        for (const n of this.nodes) {
            n.x = n.x * s + ox;
            n.y = n.y * s + oy;
        }
    }
}

function hashPuzzle(s: PuzzleState): string {
    return JSON.stringify({ nodes: s.nodes, edges: s.edges, ringCount: s.ringCount });
}

// ── Build visual graph ──

export function buildGraph(state: PuzzleState): CircuitGraph {
    const { nodes: pNodes, edges: pEdges, ringCount } = state;
    const vs = state.virtualSize;
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let eidC = 0;
    const eid = () => `e${eidC++}`;

    for (let i = 0; i < pNodes.length; i++) {
        const n = pNodes[i];
        switch (n.kind) {
            case 'junction':
                nodes.push(
                    new Junction(i, n.x, n.y, Math.round(JUNC_RADIUS_RATIO * vs), n.ring, n.jType),
                );
                break;
            case 'socket':
                nodes.push(new Socket(i, n.x, n.y, Math.round(SOCKET_RADIUS_RATIO * vs)));
                break;
            case 'source':
                nodes.push(new PowerSource(i, n.x, n.y, Math.round(POWER_RADIUS_RATIO * vs)));
                break;
            case 'node':
                nodes.push(new Node(i, n.x, n.y, Math.round(NODE_RADIUS_RATIO * vs)));
                break;
        }
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

    const sockets: number[] = [];
    for (let i = 0; i < pNodes.length; i++) {
        if (pNodes[i].kind === 'socket') sockets.push(i);
    }

    return { nodes, edges, sockets, ringCount, optimal: state.optimal };
}

// ── Render colors ──

const CO = '#14812d';
const CD = '#0f3d1e';

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
        const generator = new PuzzleGenerator();
        let state: PuzzleState | null = null;
        let hash = '';
        do {
            state = generator.generate(512);
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

    _calculatePower(state: PuzzleState, rots: number[]): Set<number> {
        return calculatePower(state, rots);
    }

    private _simulateAndRender(): void {
        if (!this._rawState) return;
        this._graph = buildGraph(this._rawState);
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

    private _drawEdges(ctx: CanvasRenderingContext2D): void {
        for (const e of this._graph!.edges) {
            const nA = this._graph!.nodes[+e.a];
            const nB = this._graph!.nodes[+e.b];
            if (!nA || !nB) continue;
            const p1 = nA.portCoord(e.aDir);
            const p2 = nB.portCoord(e.bDir);
            const isP = this._poweredEdges.has(e.idx);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isP ? CO : CD;
            ctx.lineWidth = isP ? 1.5 : 1.5;
            if (isP) {
                ctx.shadowColor = CO;
                ctx.shadowBlur = 2;
            } else {
                ctx.setLineDash([4, 4]);
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }
    }

    private _drawStatusOverlay(ctx: CanvasRenderingContext2D, size: number): void {
        const total = this._graph!.sockets.length;
        let count = 0;
        for (const r of this._graph!.sockets) if (this._powered.has(r)) count++;
        const pad = Math.round(size * PAD_RATIO);
        ctx.fillStyle = CO;
        ctx.font = `${Math.round(size * 0.027)}px "Noto Sans Symbols"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 10;
        ctx.shadowColor = CO;
        ctx.fillText(`\u26a1 ${count}/${total}`, size - pad, pad);
        ctx.shadowBlur = 0;
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

        const vs = this._rawState!.virtualSize;
        const scale = size / vs;
        ctx.save();
        ctx.scale(scale, scale);

        this._drawEdges(ctx);

        const dctx: DrawContext = {
            hoveredRing: this._hoveredRing,
            rotations: this._rotations,
            rawState: this._rawState,
            powered: this._powered,
        };
        for (const n of this._graph.nodes) {
            n.draw(ctx, dctx);
        }

        ctx.restore();

        this._drawStatusOverlay(ctx, size);
    }

    private _onCanvasMove(e: MouseEvent): void {
        if (!this._graph || !this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        const vs = this._rawState!.virtualSize;
        const scale = size / vs;
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        let foundRing = -1;
        for (const n of this._graph.nodes) {
            if (!(n instanceof Junction)) continue;
            if ((x - n.x) ** 2 + (y - n.y) ** 2 <= (n.radius * 2) ** 2) {
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
