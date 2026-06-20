import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleVjolt } from '../../src/puzzles/puzzle-vjolt';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-vjolt', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-vjolt');
        expect(el).toBeInstanceOf(PuzzleVjolt);
    });

    it('creates wall, shelf, workbench, and actions', async () => {
        const el = document.createElement('puzzle-vjolt') as PuzzleVjolt;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('.vjolt-wall')).not.toBeNull();
        expect(el.querySelector('.vjolt-shelf')).not.toBeNull();
        const shelfBtns = el.querySelectorAll('.vjolt-shelf-btn');
        expect(shelfBtns.length).toBe(3);
        expect(el.querySelector('.vjolt-workbench')).not.toBeNull();
        const bottles = el.querySelectorAll('.vjolt-workbench .vjolt-bottle');
        expect(bottles.length).toBe(4);
        expect(el.querySelector('.vjolt-actions')).not.toBeNull();
        const actionBtns = el.querySelectorAll('.vjolt-actions .vjolt-btn');
        expect(actionBtns.length).toBe(2);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-vjolt') as PuzzleVjolt;
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
        const el = document.createElement('puzzle-vjolt') as PuzzleVjolt;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('filling a bottle from shelf works', async () => {
        const el = document.createElement('puzzle-vjolt') as PuzzleVjolt;
        document.body.appendChild(el);
        await el.updateComplete;

        const shelfBtns = el.querySelectorAll<HTMLButtonElement>('.vjolt-shelf-btn');
        shelfBtns[0].click();
        await el.updateComplete;

        const bottles = el.querySelectorAll('.vjolt-workbench .vjolt-bottle');
        const filledBottles = Array.from(bottles).filter(b => !b.classList.contains('empty'));
        expect(filledBottles.length).toBe(1);

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-vjolt') as PuzzleVjolt;
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
