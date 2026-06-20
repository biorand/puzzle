import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleLabPuzzle } from '../../src/puzzles/puzzle-lab-puzzle';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-lab-puzzle', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-lab-puzzle');
        expect(el).toBeInstanceOf(PuzzleLabPuzzle);
    });

    it('creates wrap, note, and 9 cells', async () => {
        const el = document.createElement('puzzle-lab-puzzle') as PuzzleLabPuzzle;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('#lab-wrap')).not.toBeNull();
        expect(el.querySelector('#lab-note')).not.toBeNull();
        expect(el.querySelector('#lab-grid')).not.toBeNull();
        const cells = el.querySelectorAll('#lab-grid .lab-cell');
        expect(cells.length).toBe(9);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-lab-puzzle') as PuzzleLabPuzzle;
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
        const el = document.createElement('puzzle-lab-puzzle') as PuzzleLabPuzzle;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('clicking a cell dispatches status with incremented moves', async () => {
        const el = document.createElement('puzzle-lab-puzzle') as PuzzleLabPuzzle;
        document.body.appendChild(el);
        await el.updateComplete;

        const spy = vi.fn();
        el.addEventListener('puzzle-status', spy);

        const cells = el.querySelectorAll<HTMLElement>('.lab-cell');
        cells[0].click();
        await el.updateComplete;

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.objectContaining({ moves: 1 }) }),
        );

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-lab-puzzle') as PuzzleLabPuzzle;
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
