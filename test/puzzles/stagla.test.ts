import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleStagla } from '../../src/puzzles/puzzle-stagla';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-stagla', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-stagla');
        expect(el).toBeInstanceOf(PuzzleStagla);
    });

    it('creates 3 circles, 4 lights, and 4 labels', async () => {
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
        document.body.appendChild(el);
        await el.updateComplete;

        const top = el.querySelector('#stagla-top');
        expect(top).not.toBeNull();

        const circles = el.querySelectorAll('.stagla-circle');
        expect(circles.length).toBe(3);

        const lights = el.querySelectorAll('.stagla-light');
        expect(lights.length).toBe(4);

        const labels = el.querySelectorAll('.stagla-label');
        expect(labels.length).toBe(4);
    });

    it('labels show A, B, C, D', async () => {
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
        document.body.appendChild(el);
        await el.updateComplete;

        const labels = el.querySelectorAll('.stagla-label');
        expect(labels[0].textContent!.trim()).toBe('A');
        expect(labels[1].textContent!.trim()).toBe('B');
        expect(labels[2].textContent!.trim()).toBe('C');
        expect(labels[3].textContent!.trim()).toBe('D');
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
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
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
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

    it('clicking a light dispatches puzzle-status with incremented moves', async () => {
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
        document.body.appendChild(el);
        await el.updateComplete;

        const statusSpy = vi.fn();
        el.addEventListener('puzzle-status', statusSpy);

        const lights = el.querySelectorAll<HTMLDivElement>('.stagla-light');
        lights[0].click();
        await el.updateComplete;

        expect(statusSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({ moves: 1 }),
            }),
        );
    });

    it('regenerate event triggers puzzle reset', async () => {
        const el = document.createElement('puzzle-stagla') as PuzzleStagla;
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
