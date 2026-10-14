import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzlePortableSafe } from '../../src/puzzles/puzzle-portable-safe';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-portable-safe', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-portable-safe');
        expect(el).toBeInstanceOf(PuzzlePortableSafe);
    });

    it('creates ring wrap and 8 buttons', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('#safe-ring-wrap')).not.toBeNull();
        expect(el.querySelector('#safe-ring-inner')).not.toBeNull();
        expect(el.querySelector('#safe-grid')).not.toBeNull();
        const btns = el.querySelectorAll('#safe-grid .safe-btn');
        expect(btns.length).toBe(8);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
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
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('reports the true minimum of 8 presses as optimal', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        // One press per button is required and sufficient to build the chain
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ optimal: 8 }) }),
        );

        document.body.removeChild(el);
    });

    it('clicking a button dispatches status with incremented moves', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
        document.body.appendChild(el);
        await el.updateComplete;

        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);

        const btns = el.querySelectorAll<HTMLButtonElement>('.safe-btn');
        btns[0].click();
        await el.updateComplete;

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ moves: 1 }) }),
        );

        document.body.removeChild(el);
    });

    it('win animation clears the chain highlight from every light', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
        document.body.appendChild(el);
        await el.updateComplete;

        const completeSpy = vi.fn();
        el.addEventListener('puzzle-complete', completeSpy);

        const order = ((el as any)._mapping as number[])
            .map((light, btn) => ({ light, btn }))
            .sort((a, b) => a.light - b.light)
            .map((x) => x.btn);
        const btns = el.querySelectorAll<HTMLButtonElement>('.safe-btn');
        for (const btn of order) btns[btn].click();

        await new Promise((r) => setTimeout(r, 1200));

        expect(completeSpy).toHaveBeenCalled();
        expect(el.querySelectorAll('.safe-light.chain').length).toBe(0);

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-portable-safe') as PuzzlePortableSafe;
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
