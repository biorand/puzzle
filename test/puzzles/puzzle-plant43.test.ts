import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzlePlant43 } from '../../src/puzzles/puzzle-plant43';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-plant43', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-plant43');
        expect(el).toBeInstanceOf(PuzzlePlant43);
    });

    it('creates stage with 3 tubes and action buttons', async () => {
        const el = document.createElement('puzzle-plant43') as PuzzlePlant43;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('.plant43-stage')).not.toBeNull();
        const tubes = el.querySelectorAll('.plant43-tube');
        expect(tubes.length).toBe(3);
        const btns = el.querySelectorAll('.plant43-btn');
        expect(btns.length).toBe(3);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-plant43') as PuzzlePlant43;
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
        const el = document.createElement('puzzle-plant43') as PuzzlePlant43;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-plant43') as PuzzlePlant43;
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
