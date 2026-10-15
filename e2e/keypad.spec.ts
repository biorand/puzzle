import { expect, test } from '@playwright/test';

test.describe('Keypad Puzzle', () => {
    test.beforeEach(async ({ page }) => {
        // Start fresh with the keypad unlocked (puzzles unlock by being
        // completed in a run)
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('repuzzles-unlocked', JSON.stringify(['keypad']));
        });
    });

    test('fresh player sees step 1 of the tutorial with forced difficulty', async ({ page }) => {
        await page.goto('/#/re1/keypad');
        await page.waitForSelector('#keypad');

        const tutorial = page.locator('#keypad-tutorial');
        await expect(tutorial).toBeVisible();
        await expect(tutorial).toContainText('Tutorial 1/5');
        await expect(tutorial).toContainText('Solve in 1 move');
        await expect(page.locator('#optimal-num')).toHaveText('1');

        // Solve the forced 1-move puzzle
        const cellIdx = await page.evaluate(() => {
            const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
            const el = document.querySelector('puzzle-keypad') as unknown as { _state: number };
            for (let i = 0; i < 9; i++) if ((el._state ^ MASKS[i]) === 0x1ff) return i;
            return -1;
        });
        expect(cellIdx).toBeGreaterThanOrEqual(0);
        await page.locator(`.cell[data-idx="${cellIdx}"]`).click();

        // After the completion animation and regeneration, step 2 keeps forcing 1 move
        await expect(tutorial).toContainText('Tutorial 2/5', { timeout: 10000 });
        await expect(page.locator('#optimal-num')).toHaveText('1');
    });

    test('toolbar keeps its size while the puzzle completes', async ({ page }) => {
        await page.goto('/#/re1/keypad');
        await page.waitForSelector('#keypad');

        const before = await page.evaluate(() => ({
            footerH: document.querySelector('app-footer')!.getBoundingClientRect().height,
            puzzleH: document.querySelector('puzzle-keypad')!.getBoundingClientRect().height,
        }));

        await page.evaluate(() => {
            (window as any).__kp = document.querySelector('puzzle-keypad');
        });
        const cellIdx = await page.evaluate(() => {
            const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
            const kp = document.querySelector('puzzle-keypad') as any;
            for (let i = 0; i < 9; i++) if ((kp._state ^ MASKS[i]) === 0x1ff) return i;
            return -1;
        });
        expect(cellIdx).toBeGreaterThanOrEqual(0);
        await page.locator(`.cell[data-idx="${cellIdx}"]`).click();

        const during = await page.evaluate(async () => {
            const puzzle = (window as any).__kp;
            for (let i = 0; i < 200 && !puzzle._playing; i++) {
                await new Promise((r) => setTimeout(r, 10));
            }
            const footerEl = document.querySelector('app-footer')!;
            const buttons = Array.from(footerEl.shadowRoot!.querySelectorAll('button'));
            const newLabel = buttons[0].querySelector('.btn-label') as HTMLElement;
            return {
                playing: puzzle._playing,
                footerH: footerEl.getBoundingClientRect().height,
                puzzleH: puzzle.getBoundingClientRect().height,
                newDisabled: buttons[0].disabled,
                newLabelDisplay: getComputedStyle(newLabel).display,
            };
        });

        expect(during.playing).toBe(true);
        expect(Math.abs(during.footerH - before.footerH)).toBeLessThanOrEqual(1);
        expect(Math.abs(during.puzzleH - before.puzzleH)).toBeLessThanOrEqual(1);
        expect(during.newDisabled).toBe(true);
        expect(during.newLabelDisplay).not.toBe('none');
    });

    test('cheat-unlock-all overlay shows CHEAT ACTIVATED and ALL PUZZLES, then navigates home', async ({
        page,
    }) => {
        // Disable sound so melodies resolve instantly (avoids AudioContext issues in headless)
        await page.evaluate(() => {
            localStorage.setItem('repuzzles-sound-enabled', 'false');
        });

        // Navigate to keypad puzzle
        await page.goto('/#/re1/keypad');
        await page.waitForSelector('#keypad');

        // The cheat event listener listens on the puzzle-keypad element.
        // Dispatch the cheat event directly to test the handler integration.
        await page.evaluate(async () => {
            const el = document.querySelector('puzzle-keypad');
            if (!el) throw new Error('puzzle-keypad not found');
            el.dispatchEvent(
                new CustomEvent('cheat-unlock-all', {
                    detail: {
                        playMelodyFn: Promise.resolve(),
                    },
                    bubbles: true,
                    composed: true,
                }),
            );
        });

        // Overlay should appear immediately with correct text
        const overlay = page.locator('#complete-overlay');
        await expect(overlay).not.toHaveClass(/hidden/);
        await expect(overlay.locator('#complete-text')).toHaveText('CHEAT ACTIVATED');
        await expect(overlay.locator('#completed-unlock-name')).toHaveText('ALL PUZZLES');

        // Overlay stays visible for 3 seconds, then navigates to main menu
        await page.waitForTimeout(3500);
        await expect(page).toHaveURL('/#/');

        // Verify all puzzles are now unlocked
        const unlocked = await page.evaluate(
            () => JSON.parse(localStorage.getItem('repuzzles-unlocked') || '[]') as string[],
        );
        expect(unlocked.length).toBe(10);

        // All 10 cards should be enabled (no locked class)
        await page.evaluate(() => (location.hash = '#/quickplay'));
        await page.waitForSelector('puzzle-select #menu-grid');
        await expect(page.locator('.menu-card.locked')).toHaveCount(0);
    });

    test('pressing cheat sequence 2-2-3-6 three times unlocks all puzzles', async ({ page }) => {
        // Disable sound so melodies resolve instantly
        await page.evaluate(() => {
            localStorage.setItem('repuzzles-sound-enabled', 'false');
        });

        // Navigate to keypad
        await page.goto('/#/re1/keypad');
        await page.waitForSelector('#keypad');

        // Set high difficulty to avoid accidental puzzle solve before 3rd cheat activation
        await page.evaluate(() => {
            const el = document.querySelector('puzzle-keypad') as any;
            if (el) {
                el.forceDifficulty = 4;
                el.regenerate();
            }
        });
        await page.waitForTimeout(100);

        // Press cheat sequence 2-2-3-6 three times (cells with data-idx 1, 1, 2, 5)
        for (let round = 0; round < 3; round++) {
            // If the puzzle got solved (all orange) before we finish, regenerate
            const isSolved = await page.evaluate(() => {
                const el = document.querySelector('puzzle-keypad');
                if (!el) return false;
                return el.querySelectorAll('.cell.orange').length === 9;
            });
            if (isSolved) {
                await page.evaluate(() => {
                    const el = document.querySelector('puzzle-keypad') as any;
                    if (el) {
                        el.forceDifficulty = 4;
                        el.regenerate();
                    }
                });
                await page.waitForTimeout(100);
            }

            await page.click('.cell[data-idx="1"]'); // button "2"
            await page.click('.cell[data-idx="1"]'); // button "2"
            await page.click('.cell[data-idx="2"]'); // button "3"
            await page.click('.cell[data-idx="5"]'); // button "6"
        }

        // After the third cheat sequence, the overlay should appear
        const overlay = page.locator('#complete-overlay');
        await expect(overlay).not.toHaveClass(/hidden/);
        await expect(overlay.locator('#complete-text')).toHaveText('CHEAT ACTIVATED');
        await expect(overlay.locator('#completed-unlock-name')).toHaveText('ALL PUZZLES');

        // Overlay stays visible for 3 seconds, then navigates to main menu
        await page.waitForTimeout(3500);
        await expect(page).toHaveURL('/#/');

        // Verify all puzzles are unlocked
        const unlocked = await page.evaluate(
            () => JSON.parse(localStorage.getItem('repuzzles-unlocked') || '[]') as string[],
        );
        expect(unlocked.length).toBe(10);
    });
});
