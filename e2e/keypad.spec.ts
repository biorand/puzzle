import { expect, test } from '@playwright/test';

test.describe('Keypad Puzzle', () => {
    test.beforeEach(async ({ page }) => {
        // Start fresh — only keypad unlocked
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
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
        const progress = await page.evaluate(() =>
            parseInt(localStorage.getItem('repuzzles-progress') || '0', 10),
        );
        expect(progress).toBe(8); // puzzleOrder.length - 1

        // All 9 cards should be enabled (no locked class)
        const lockedCards = page.locator('.menu-card.locked');
        await expect(lockedCards).toHaveCount(0);
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

        // Verify progress
        const progress = await page.evaluate(() =>
            parseInt(localStorage.getItem('repuzzles-progress') || '0', 10),
        );
        expect(progress).toBe(8);
    });
});
