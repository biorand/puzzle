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
