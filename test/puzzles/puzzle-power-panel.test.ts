import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzlePowerPanel } from '../../src/puzzles/puzzle-power-panel';

vi.mock('../../src/audio', () => ({
    playTone: vi.fn(),
    playChime: vi.fn(),
    playMelody: vi.fn().mockResolvedValue(undefined),
    initAudioOnFirstClick: vi.fn(),
}));

describe('puzzle-power-panel', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('custom element is defined', () => {
        const el = document.createElement('puzzle-power-panel');
        expect(el).toBeInstanceOf(PuzzlePowerPanel);
    });

    it('creates meter, switches, and action buttons', async () => {
        const el = document.createElement('puzzle-power-panel') as PuzzlePowerPanel;
        document.body.appendChild(el);
        await el.updateComplete;

        expect(el.querySelector('#pp-meter')).not.toBeNull();
        expect(el.querySelector('#pp-switches')).not.toBeNull();
        expect(el.querySelector('#pp-actions')).not.toBeNull();
        const cols = el.querySelectorAll('#pp-switches .pp-switch-col');
        expect(cols.length).toBe(5);
        const btns = el.querySelectorAll('#pp-action-btns .pp-action-btn');
        expect(btns.length).toBe(2);

        document.body.removeChild(el);
    });

    it('dispatches puzzle-status after creation', async () => {
        const el = document.createElement('puzzle-power-panel') as PuzzlePowerPanel;
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
        const el = document.createElement('puzzle-power-panel') as PuzzlePowerPanel;
        const spy = vi.fn();
        el.addEventListener('puzzle-actions', spy);
        document.body.appendChild(el);
        await el.updateComplete;

        expect(spy).toHaveBeenCalled();

        document.body.removeChild(el);
    });

    it('regenerate event resets puzzle', async () => {
        const el = document.createElement('puzzle-power-panel') as PuzzlePowerPanel;
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

    it('plays completion chime when puzzle is solved', async () => {
        // This is a regression test: _completePuzzle must call playChime
        const { playChime } = await import('../../src/audio');
        const el = document.createElement('puzzle-power-panel') as PuzzlePowerPanel;
        document.body.appendChild(el);
        await el.updateComplete;

        // Read switch values and target, then compute and click the solution
        const vals = el._switchValues;
        const target = el._currentTarget;
        let needle = 0;
        const seq: ('up' | 'down')[] = [];
        for (let i = 0; i < 5; i++) {
            const afterUp = needle + vals[i].x;
            const afterDown = needle - vals[i].y;
            if (afterUp === target) {
                seq.push('up');
                needle = afterUp;
            } else if (afterDown === target) {
                seq.push('down');
                needle = afterDown;
            } else if (
                afterUp <= 100 &&
                (afterDown < 0 || Math.abs(afterUp - target) <= Math.abs(afterDown - target))
            ) {
                seq.push('up');
                needle = afterUp;
            } else {
                seq.push('down');
                needle = afterDown;
            }
        }

        for (const dir of seq) {
            const btns = el.querySelectorAll('#pp-action-btns .pp-action-btn');
            for (const btn of btns) {
                if ((btn as HTMLElement).dataset.direction === dir) {
                    (btn as HTMLButtonElement).click();
                    break;
                }
            }
            await new Promise((r) => setTimeout(r, 100));
        }

        // Wait for completion async work
        await new Promise((r) => setTimeout(r, 500));
        await el.updateComplete;

        expect(playChime).toHaveBeenCalled();

        document.body.removeChild(el);
    });
});
