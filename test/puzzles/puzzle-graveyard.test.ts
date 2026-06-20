import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleGraveyard } from '../../src/puzzles/puzzle-graveyard';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

if (typeof ResizeObserver === 'undefined') {
    class FakeResizeObserver {
        observe() { /* noop */ }
        unobserve() { /* noop */ }
        disconnect() { /* noop */ }
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
}

describe('puzzle-graveyard', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-graveyard');
        expect(el).toBeInstanceOf(PuzzleGraveyard);
    });

    it('creates layout with dial area and buttons', async () => {
        const el = document.createElement('puzzle-graveyard') as PuzzleGraveyard;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('#graveyard-layout')).not.toBeNull();
        expect(el.querySelector('#graveyard-dial-area')).not.toBeNull();
        expect(el.querySelector('#graveyard-ring-wrap')).not.toBeNull();
        expect(el.querySelector('#graveyard-pointer')).not.toBeNull();
        expect(el.querySelector('#graveyard-goal')).not.toBeNull();
        const btns = el.querySelectorAll('#graveyard-btns .graveyard-btn');
        expect(btns.length).toBe(2);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-graveyard') as PuzzleGraveyard;
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
        const el = document.createElement('puzzle-graveyard') as PuzzleGraveyard;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-graveyard') as PuzzleGraveyard;
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

    it('positions symbols within dial bounds after render', async () => {
        // Regression test: symbols must stay within ring bounds
        const el = document.createElement('puzzle-graveyard') as PuzzleGraveyard;
        document.body.appendChild(el);
        await el.updateComplete;

        // _positionDial runs in firstUpdated and via ResizeObserver.
        // Manually trigger it at a known size.
        const dialArea = el.querySelector('#graveyard-dial-area') as HTMLElement;
        Object.defineProperty(dialArea, 'clientWidth', { value: 400 });
        Object.defineProperty(dialArea, 'clientHeight', { value: 400 });

        // Re-trigger positioning
        el['_positionDial']();
        await el.updateComplete;

        expect(el._symbolPositions.length).toBe(7);

        const ringSize = el._ringSize;
        expect(ringSize).toBeGreaterThan(0);

        for (let i = 0; i < el._symbolPositions.length; i++) {
            const pos = el._symbolPositions[i];
            const leftNum = parseFloat(pos.left);
            const topNum = parseFloat(pos.top);
            const wNum = parseFloat(pos.width);
            const hNum = parseFloat(pos.height);
            const ml = parseFloat(pos.marginLeft);
            const mt = parseFloat(pos.marginTop);

            // Left edge of symbol (left + marginLeft) should be >= 0
            const leftEdge = leftNum + ml;
            const topEdge = topNum + mt;
            const rightEdge = leftEdge + wNum;
            const bottomEdge = topEdge + hNum;

            expect(leftEdge).toBeGreaterThanOrEqual(0);
            expect(topEdge).toBeGreaterThanOrEqual(0);
            expect(rightEdge).toBeLessThanOrEqual(ringSize);
            expect(bottomEdge).toBeLessThanOrEqual(ringSize);
            expect(wNum).toBeGreaterThan(0);
            expect(hNum).toBeGreaterThan(0);
        }

        document.body.removeChild(el);
    });
});
