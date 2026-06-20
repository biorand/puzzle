import { expect, test } from '@playwright/test';

test.describe('Stagla Puzzle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('repuzzles-progress', '10');
        });
        await page.goto('/#/re3/stagla');
        await page.waitForSelector('puzzle-stagla');
        await page.waitForTimeout(200);
    });

    test('renders all puzzle elements', async ({ page }) => {
        await expect(page.locator('.stagla-circle')).toHaveCount(3);
        await expect(page.locator('.stagla-light')).toHaveCount(4);
        await expect(page.locator('.stagla-label')).toHaveCount(4);
    });

    test('all 3 circles light up as each stage is completed (regression: 3rd circle)', async ({ page }) => {
        // Compute and execute a solution for all 3 stages, then verify circles
        const TOGGLES: number[][] = [[0, 1], [0, 1, 2], [1, 2, 3], [2, 3]];

        for (let stage = 0; stage < 3; stage++) {
            // Read current lights state and target from DOM
            const solveResult = await page.evaluate((toggles) => {
                // Read lights: .stagla-light elements with 'on' class
                const lightEls = document.querySelectorAll('.stagla-light');
                const lights: boolean[] = [];
                for (const el of lightEls) {
                    lights.push(el.classList.contains('on'));
                }

                // Read target: .stagla-label elements with 'target' class
                const labelEls = document.querySelectorAll('.stagla-label');
                let target = -1;
                for (let i = 0; i < labelEls.length; i++) {
                    if (labelEls[i].classList.contains('target')) {
                        target = i;
                        break;
                    }
                }

                // Brute-force: find a subset of button presses that solves this stage
                for (let mask = 0; mask < 16; mask++) {
                    const result = [...lights];
                    for (let b = 0; b < 4; b++) {
                        if (mask & (1 << b)) {
                            for (const t of toggles[b]) result[t] = !result[t];
                        }
                    }
                    let valid = true;
                    for (let i = 0; i < 4; i++) {
                        if (i === target && !result[i]) valid = false;
                        if (i !== target && result[i]) valid = false;
                    }
                    if (valid) {
                        const seq: number[] = [];
                        for (let b = 0; b < 4; b++) if (mask & (1 << b)) seq.push(b);
                        return seq;
                    }
                }
                return null;
            }, TOGGLES);

            expect(solveResult).not.toBeNull();
            if (!solveResult) continue;

            // Click the solution buttons
            for (const idx of solveResult) {
                await page.locator('.stagla-light').nth(idx).click();
                await page.waitForTimeout(100);
            }

            if (stage < 2) {
                // Wait for stage completion flash animation to finish
                await page.waitForTimeout(1500);
            } else {
                // Stage 3: wait for completion animation
                await page.waitForTimeout(3000);
            }
        }

        // Verify all 3 circles have the 'on' class
        const circleClasses = await page.evaluate(() => {
            const circles = document.querySelectorAll('.stagla-circle');
            return Array.from(circles).map((el) => el.classList.contains('on'));
        });
        expect(circleClasses).toEqual([true, true, true]);
    });
});
