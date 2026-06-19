import { expect, test } from '@playwright/test';

test.describe('Power Panel Puzzle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('repuzzles-progress', '10');
        });
        await page.goto('/#/re2/power-panel');
        await page.waitForSelector('#pp-layout');
        await page.waitForTimeout(200);
    });

    test('renders all puzzle elements', async ({ page }) => {
        await expect(page.locator('#pp-meter')).toBeVisible();
        await expect(page.locator('.pp-meter-labels')).toBeVisible();
        await expect(page.locator('.pp-meter-ticks')).toBeVisible();
        await expect(page.locator('.pp-meter-track')).toBeVisible();
        await expect(page.locator('.pp-meter-red')).toBeVisible();
        await expect(page.locator('.pp-needle')).toBeVisible();
        await expect(page.locator('.pp-target-marker')).toBeVisible();

        await expect(page.locator('.pp-label')).toHaveCount(11);
        await expect(page.locator('.pp-tick')).toHaveCount(11);

        await expect(page.locator('#pp-switches')).toBeVisible();
        await expect(page.locator('.pp-switch-col')).toHaveCount(5);
        await expect(page.locator('.pp-lever')).toHaveCount(5);
        await expect(page.locator('.pp-step-up')).toHaveCount(5);
        await expect(page.locator('.pp-step-down')).toHaveCount(5);

        // All five UP labels should be identical and match format "+N"
        const upLabels = await page.$$eval('.pp-step-up', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(upLabels.length).toBe(5);
        expect(new Set(upLabels).size).toBe(1);
        expect(upLabels[0]).toMatch(/^\+\d+$/);

        // All five DOWN labels should be identical and match format "-N"
        const downLabels = await page.$$eval('.pp-step-down', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(downLabels.length).toBe(5);
        expect(new Set(downLabels).size).toBe(1);
        expect(downLabels[0]).toMatch(/^-\d+$/);

        await expect(page.locator('#pp-actions')).toBeVisible();
        await expect(page.locator('.pp-action-btn')).toHaveCount(2);

        // Button labels should match the step labels
        const upVal = upLabels[0].slice(1);
        const downVal = downLabels[0].slice(1);
        await expect(page.locator('.pp-btn-up')).toHaveText(`▲ UP (+${upVal})`);
        await expect(page.locator('.pp-btn-down')).toHaveText(`▼ DOWN (-${downVal})`);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('UP button advances needle', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);
    });

    test('press UP then DOWN shows correct states', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);

        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').nth(1)).toHaveClass(/pp-down/);
    });

    test('labels show correct format on every new puzzle', async ({ page }) => {
        // Read current values
        const v1 = await page.evaluate(() => {
            const up = document.querySelector('.pp-step-up')?.textContent?.trim();
            const down = document.querySelector('.pp-step-down')?.textContent?.trim();
            return { up, down };
        });
        expect(v1.up).toMatch(/^\+\d+$/);
        expect(v1.down).toMatch(/^-\d+$/);

        // Click "New" to get a fresh config
        await page.locator('#app-footer .action-btn').first().click();
        await page.waitForTimeout(300);

        const v2 = await page.evaluate(() => {
            const up = document.querySelector('.pp-step-up')?.textContent?.trim();
            const down = document.querySelector('.pp-step-down')?.textContent?.trim();
            const marker = document.querySelector('.pp-target-marker') as HTMLElement;
            return { up, down, left: marker?.style?.left };
        });
        expect(v2.up).toMatch(/^\+\d+$/);
        expect(v2.down).toMatch(/^-\d+$/);
        expect(v2.left).toMatch(/\d+%/);
    });

    test('pressing DOWN at 0 triggers flash and reset', async ({ page }) => {
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(1200);
        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('pressing UP many times exceeds 100 and resets', async ({ page }) => {
        // Check whether the current config can overflow with repeated UPs
        const canOverflow = await page.evaluate(() => {
            const up = document.querySelector('.pp-step-up')?.textContent?.trim();
            return parseInt(up!) > 20;
        });
        if (!canOverflow) return; // skip — x is small enough that 5 UPs stays at 100

        // Force-click UP many times. Clicks during overflow (button disabled)
        // still register because we use force:true, but they're ignored by
        // press() since playingRef is true. Eventually the overflow resets.
        for (let i = 0; i < 10; i++) {
            await page.locator('.pp-btn-up').click({ force: true });
            await page.waitForTimeout(400);

            // Check if reset has completed (needle at 0, first switch active)
            const isReset = await page.evaluate(() => {
                const el = document.querySelector('.pp-needle') as HTMLElement;
                const pct = parseFloat(el?.style?.left || '100');
                const first = document.querySelector('.pp-switch-col') as HTMLElement;
                return pct === 0 && first?.classList.contains('pp-active');
            });
            if (isReset) break;
        }

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('wrong final value triggers flash and resets', async ({ page }) => {
        // Read current config values — y is stored as positive, labels show "-14" etc
        const values = await page.evaluate(() => {
            const up = document.querySelector('.pp-step-up')?.textContent?.trim();
            const down = document.querySelector('.pp-step-down')?.textContent?.trim();
            const marker = document.querySelector('.pp-target-marker') as HTMLElement;
            const targetPct = parseFloat(marker.style.left);
            return {
                x: parseInt(up!),
                y: Math.abs(parseInt(down!)),
                target: Math.round((targetPct / 100) * 100),
            };
        });

        // Find a sequence that stays in bounds but does NOT end at the target
        const seq = await page.evaluate(({ x, y, target }) => {
            for (let mask = 0; mask < 32; mask++) {
                let pos = 0;
                let ok = true;
                const seq: boolean[] = [];
                for (let i = 0; i < 5; i++) {
                    const isUp = !!(mask & (1 << i));
                    seq.push(isUp);
                    pos += isUp ? x : -y;
                    if (pos < 0 || pos > 100) {
                        ok = false;
                        break;
                    }
                }
                if (ok && pos !== target) return seq;
            }
            return null;
        }, values);

        if (!seq) return; // skip — no wrong-ending path for this config

        for (const isUp of seq) {
            if (isUp) await page.locator('.pp-btn-up').click();
            else await page.locator('.pp-btn-down').click();
            await page.waitForTimeout(400);
        }

        await page.waitForTimeout(800);
        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('solving with a correct sequence completes the puzzle', async ({ page }) => {
        // Read current config values
        const values = await page.evaluate(() => {
            const up = document.querySelector('.pp-step-up')?.textContent?.trim();
            const down = document.querySelector('.pp-step-down')?.textContent?.trim();
            const marker = document.querySelector('.pp-target-marker') as HTMLElement;
            const targetPct = parseFloat(marker.style.left);
            return {
                x: parseInt(up!),
                y: Math.abs(parseInt(down!)),
                target: Math.round((targetPct / 100) * 100),
            };
        });

        // BFS for a sequence that ends at the target
        const seq = await page.evaluate(({ x, y, target }) => {
            for (let mask = 0; mask < 32; mask++) {
                let pos = 0;
                let ok = true;
                const seq: boolean[] = [];
                for (let i = 0; i < 5; i++) {
                    const isUp = !!(mask & (1 << i));
                    seq.push(isUp);
                    pos += isUp ? x : -y;
                    if (pos < 0 || pos > 100) {
                        ok = false;
                        break;
                    }
                }
                if (ok && pos === target) return seq;
            }
            return null;
        }, values);

        expect(seq).not.toBeNull();

        for (const isUp of seq!) {
            if (isUp) await page.locator('.pp-btn-up').click();
            else await page.locator('.pp-btn-down').click();
            await page.waitForTimeout(400);
        }

        await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#complete-text')).toHaveText('COMPLETED');
    });

    test('active switch advances with each press', async ({ page }) => {
        const cols = page.locator('.pp-switch-col');

        await expect(cols.nth(0)).toHaveClass(/pp-active/);

        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(cols.nth(1)).toHaveClass(/pp-active/);

        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(cols.nth(2)).toHaveClass(/pp-active/);

        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(500);
        await expect(cols.nth(3)).toHaveClass(/pp-active/);
    });

    test('lever visually shows UP and DOWN states', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);

        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').nth(1)).toHaveClass(/pp-up/);

        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').nth(2)).toHaveClass(/pp-down/);
    });

    test('reset button restores initial state', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);

        await page.locator('#app-footer .action-btn').last().click();
        await page.waitForTimeout(300);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });
});
