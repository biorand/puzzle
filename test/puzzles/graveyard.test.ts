import { afterEach, describe, expect, it, vi } from 'vitest';
import { graveyard } from '../../src/puzzles/graveyard';
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

describe('graveyard', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates the layout with dial area, goal row, and buttons', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = graveyard.create(container, ctx);

        const layout = container.querySelector('#graveyard-layout');
        expect(layout).not.toBeNull();

        const dialArea = container.querySelector('#graveyard-dial-area');
        expect(dialArea).not.toBeNull();

        const ringWrap = container.querySelector('#graveyard-ring-wrap');
        expect(ringWrap).not.toBeNull();

        const pointer = container.querySelector('#graveyard-pointer');
        expect(pointer).not.toBeNull();

        const logo = container.querySelector('#graveyard-logo');
        expect(logo).not.toBeNull();

        const goalRow = container.querySelector('#graveyard-goal');
        expect(goalRow).not.toBeNull();

        const goalSymbols = container.querySelectorAll('.graveyard-goal-symbol');
        expect(goalSymbols.length).toBe(7);

        const buttons = container.querySelectorAll<HTMLButtonElement>('.graveyard-btn');
        expect(buttons.length).toBe(2);

        instance.destroy();
    });

    it('creates 7 symbol elements around the ring', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = graveyard.create(container, ctx);

        const symbols = container.querySelectorAll('.graveyard-symbol');
        expect(symbols.length).toBe(7);

        instance.destroy();
    });

    it('calls setStatus after creation', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = graveyard.create(container, ctx);

        expect(ctx.setStatus).toHaveBeenCalledWith(expect.objectContaining({ moves: 0 }));

        instance.destroy();
    });

    it('sets actions on creation', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = graveyard.create(container, ctx);

        expect(ctx.setActions).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ label: 'New Puzzle' })]),
        );

        instance.destroy();
    });

    it('destroy cleans up the container', () => {
        const container = document.createElement('div');
        const ctx = createMockContext();
        const instance = graveyard.create(container, ctx);

        instance.destroy();
        expect(container.innerHTML).toBe('');
    });
});
