import { afterEach, describe, expect, it, vi } from 'vitest';
import { stagla } from '../../src/puzzles/stagla';
import type { PuzzleContext } from '../../src/types';

function createMockContext(): PuzzleContext {
    return {
        setStatus: vi.fn(),
        setActions: vi.fn(),
        showOverlay: vi.fn().mockResolvedValue(undefined),
        hideOverlay: vi.fn(),
        playTone: vi.fn(),
        playChime: vi.fn(),
        playMelody: vi.fn().mockResolvedValue(undefined),
        score: { count: 0, increment: vi.fn().mockReturnValue(null) },
    };
}

describe('stagla', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates 3 circles, 4 lights, and 4 labels', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        const top = container.querySelector('#stagla-top');
        expect(top).not.toBeNull();

        const circles = container.querySelectorAll('.stagla-circle');
        expect(circles.length).toBe(3);

        const lights = container.querySelectorAll('.stagla-light');
        expect(lights.length).toBe(4);

        const labels = container.querySelectorAll('.stagla-label');
        expect(labels.length).toBe(4);

        instance.destroy();
    });

    it('labels show A, B, C, D', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        const labels = container.querySelectorAll('.stagla-label');
        expect(labels[0].textContent).toBe('A');
        expect(labels[1].textContent).toBe('B');
        expect(labels[2].textContent).toBe('C');
        expect(labels[3].textContent).toBe('D');

        instance.destroy();
    });

    it('calls setStatus after creation', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 0 }));

        instance.destroy();
    });

    it('sets actions on creation', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        expect(ctx.setActions).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ label: 'New Puzzle' }),
                expect.objectContaining({ label: 'Reset' }),
            ]),
        );

        instance.destroy();
    });

    it('clicking a light toggles it and increments moves', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        const lights = container.querySelectorAll<HTMLDivElement>('.stagla-light');
        lights[0].click();

        expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 1 }));
        expect(ctx.playTone).toHaveBeenCalled();

        instance.destroy();
    });

    it('destroy cleans up the container', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = stagla.create(container, ctx);

        instance.destroy();
        expect(container.innerHTML).toBe('');
    });
});
