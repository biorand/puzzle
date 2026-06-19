import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleKeypad } from '../../src/puzzles/puzzle-keypad';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-keypad', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-keypad');
        expect(el).toBeInstanceOf(PuzzleKeypad);
    });

    it('creates 9 buttons inside #keypad', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
        document.body.appendChild(el);
        await el.updateComplete;

        const keypadEl = el.querySelector('#keypad');
        expect(keypadEl).not.toBeNull();

        const buttons = el.querySelectorAll<HTMLButtonElement>('#keypad .cell');
        expect(buttons.length).toBe(9);
        buttons.forEach((btn, i) => {
            expect(btn.textContent!.trim()).toBe(String(i + 1));
        });
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
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
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
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

    it('shows tutorial div when tutorialStep is provided', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
        el.tutorialStep = 0;
        el.forceDifficulty = 1;
        document.body.appendChild(el);
        await el.updateComplete;

        const tutorialDiv = el.querySelector('#keypad-tutorial');
        expect(tutorialDiv).not.toBeNull();
        expect(tutorialDiv!.textContent).toContain('Tutorial 1/5');
    });

    it('regenerate method resets to a new puzzle', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
        document.body.appendChild(el);
        await el.updateComplete;

        const actionsSpy = vi.fn();
        el.addEventListener('puzzle-actions', actionsSpy);

        el.regenerate();
        await el.updateComplete;

        expect(actionsSpy).toHaveBeenCalled();
    });

    it('clicking a button dispatches puzzle-status with incremented moves', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
        document.body.appendChild(el);
        await el.updateComplete;

        const statusSpy = vi.fn();
        el.addEventListener('puzzle-status', statusSpy);

        const buttons = el.querySelectorAll<HTMLButtonElement>('#keypad .cell');
        buttons[0].click();
        await el.updateComplete;

        expect(statusSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({ moves: 1 }),
            }),
        );
    });

    it('regenerate event triggers puzzle reset', async () => {
        const el = document.createElement('puzzle-keypad') as PuzzleKeypad;
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
