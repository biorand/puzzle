import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';
import { puzzles } from '../puzzles/index';
import type { RunResult } from '../types';

function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    if (h > 0) return `${h}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RANK_COLORS: Record<string, string> = {
    'S+': '#ffd700',
    S: '#00ff88',
    A: '#4488ff',
    B: '#ff8800',
    C: '#ff4444',
    D: '#888888',
};

export class RunResults extends LitElement {
    @state() private _result: RunResult | null = null;

    createRenderRoot() {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        const data = sessionStorage.getItem('repuzzles-run-result');
        if (data) {
            try {
                this._result = JSON.parse(data) as RunResult;
            } catch {
                this._result = null;
            }
        }
    }

    private _onBack(): void {
        location.hash = '#/';
    }

    private _onPlayAgain(): void {
        if (!this._result) return;
        const mode = this._result.mode;
        location.hash = mode === 'vanilla' ? '#/run/vanilla' : '#/run/random';
    }

    render() {
        const r = this._result;
        if (!r) {
            return html`
                <app-header title="Results" ?show-back=${true} @back=${this._onBack}></app-header>
                <div class="results-page">
                    <p>No run data found.</p>
                    <button class="results-btn" @click=${this._onBack}>Back to Menu</button>
                </div>
            `;
        }

        const rankColor = RANK_COLORS[r.rank] ?? '#fff';
        const modeLabel = r.mode === 'vanilla' ? 'Vanilla Run' : 'Randomizer Run';

        return html`
            <app-header title="Run Complete" ?show-back=${true} @back=${this._onBack}></app-header>
            <div class="results-page">
                <div class="results-mode">${modeLabel}</div>
                <div class="results-rank" style="color: ${rankColor}">${r.rank}</div>
                <div class="results-stats">
                    <div class="results-stat">
                        <span class="results-stat-label">Time</span>
                        <span class="results-stat-value">${formatTime(r.totalTime)}</span>
                    </div>
                    <div class="results-stat">
                        <span class="results-stat-label">Moves</span>
                        <span class="results-stat-value">${r.totalMoves}</span>
                    </div>
                    <div class="results-stat">
                        <span class="results-stat-label">Optimal</span>
                        <span class="results-stat-value">${r.totalOptimal}</span>
                    </div>
                    <div class="results-stat">
                        <span class="results-stat-label">Efficiency</span>
                        <span class="results-stat-value"
                            >${((r.totalOptimal / r.totalMoves) * 100).toFixed(1)}%</span
                        >
                    </div>
                </div>
                <div class="results-puzzles">
                    ${r.puzzles.map(
                        (p, i) => html`
                            <div class="results-puzzle-row">
                                <span class="results-puzzle-idx">#${i + 1}</span>
                                <span class="results-puzzle-name"
                                    >${puzzles.get(p.puzzleId)?.name ?? p.puzzleId}</span
                                >
                                <span class="results-puzzle-config">${p.configLabel}</span>
                                <span class="results-puzzle-moves">${p.moves} / ${p.optimal}</span>
                                <span class="results-puzzle-time">${formatTime(p.time)}</span>
                            </div>
                        `,
                    )}
                </div>
                <div class="results-actions">
                    <button class="results-btn results-btn-primary" @click=${this._onPlayAgain}>
                        Play Again
                    </button>
                    <button class="results-btn" @click=${this._onBack}>Back to Menu</button>
                </div>
            </div>
        `;
    }
}

customElements.define('run-results', RunResults);

declare global {
    interface HTMLElementTagNameMap {
        'run-results': RunResults;
    }
}
