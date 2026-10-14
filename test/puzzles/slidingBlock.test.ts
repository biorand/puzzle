import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleSlidingBlock } from '../../src/puzzles/puzzle-sliding-block';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

if (typeof ResizeObserver === 'undefined') {
    class FakeResizeObserver {
        observe() {
            /* noop */
        }
        unobserve() {
            /* noop */
        }
        disconnect() {
            /* noop */
        }
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
}

describe('puzzle-sliding-block', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-sliding-block');
        expect(el).toBeInstanceOf(PuzzleSlidingBlock);
    });

    it('creates the wrapping container and grid', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        document.body.appendChild(el);
        await el.updateComplete;

        const wrap = el.querySelector('#sliding-wrap');
        expect(wrap).not.toBeNull();

        const grid = el.querySelector('#sliding-grid');
        expect(grid).not.toBeNull();
    });

    it('creates 8 tiles (values 1–8)', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        document.body.appendChild(el);
        await el.updateComplete;

        const tiles = el.querySelectorAll<HTMLElement>('.sliding-tile');
        expect(tiles.length).toBe(8);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        const statusSpy = vi.fn();
        el.addEventListener('puzzle-status', statusSpy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(statusSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({ moves: 0 }),
            }),
        );
    });

    it('dispatches puzzle-actions on creation', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        const actionsSpy = vi.fn();
        el.addEventListener('puzzle-actions', actionsSpy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(actionsSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.arrayContaining([
                    expect.objectContaining({ label: 'New Puzzle' }),
                    expect.objectContaining({ label: 'Reset' }),
                ]),
            }),
        );
    });

    it('activates a tile with the Enter key', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        document.body.appendChild(el);
        await el.updateComplete;

        const board = (el as unknown as { _board: number[] })._board;
        const blank = board.indexOf(0);
        const bRow = Math.floor(blank / 3);
        const bCol = blank % 3;
        const targetPos = bRow * 3 + ((bCol + 1) % 3);
        const val = board[targetPos];
        const tile = el.querySelector<HTMLElement>(`.sliding-tile[data-value="${val}"]`)!;

        expect(tile.tabIndex).toBe(0);
        expect(tile.getAttribute('role')).toBe('button');

        tile.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await el.updateComplete;

        expect((el as unknown as { _board: number[] })._board.indexOf(0)).toBe(targetPos);

        document.body.removeChild(el);
    });

    it('regenerate event triggers puzzle reset', async () => {
        const el = document.createElement('puzzle-sliding-block') as PuzzleSlidingBlock;
        document.body.appendChild(el);
        await el.updateComplete;

        const statusSpy = vi.fn();
        el.addEventListener('puzzle-status', statusSpy);

        el.dispatchEvent(new CustomEvent('puzzle-regenerate'));
        await el.updateComplete;

        expect(statusSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({ moves: 0 }),
            }),
        );
    });
});
