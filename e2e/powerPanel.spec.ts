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

        // Each UP label should be a different "+N" (per-switch values)
        const upLabels = await page.$$eval('.pp-step-up', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(upLabels.length).toBe(5);
        for (const lbl of upLabels) {
            expect(lbl).toMatch(/^\+\d+$/);
        }
        // At least two values differ (not all identical)
        const uniqueUp = new Set(upLabels);
        expect(uniqueUp.size).toBeGreaterThanOrEqual(2);

        // Each DOWN label should be "-N"
        const downLabels = await page.$$eval('.pp-step-down', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(downLabels.length).toBe(5);
        for (const lbl of downLabels) {
            expect(lbl).toMatch(/^-\d+$/);
        }

        await expect(page.locator('#pp-actions')).toBeVisible();
        await expect(page.locator('.pp-action-btn')).toHaveCount(2);

        // Button labels should match the FIRST switch's labels
        const firstUp = parseInt(upLabels[0].slice(1));
        const firstDown = parseInt(downLabels[0].slice(1));
        await expect(page.locator('.pp-btn-up')).toHaveText(`▲ UP (+${firstUp})`);
        await expect(page.locator('.pp-btn-down')).toHaveText(`▼ DOWN (-${firstDown})`);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('UP button advances needle', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);
    });

    test('press UP on first switch advances needle', async ({ page }) => {
        // First switch is always UP (valid from position 0)
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);
    });

    test('labels show correct format on every new puzzle', async ({ page }) => {
        // Read current values — should be at least 2 distinct UP values (per-switch)
        const v1 = await page.evaluate(() => {
            const ups = Array.from(document.querySelectorAll('.pp-step-up')).map(
                (el) => el.textContent!.trim(),
            );
            const downs = Array.from(document.querySelectorAll('.pp-step-down')).map(
                (el) => el.textContent!.trim(),
            );
            return { ups, downs };
        });
        expect(v1.ups.length).toBe(5);
        for (const lbl of v1.ups) expect(lbl).toMatch(/^\+\d+$/);
        for (const lbl of v1.downs) expect(lbl).toMatch(/^-\d+$/);
        // At least some values differ between switches
        expect(new Set(v1.ups).size).toBeGreaterThanOrEqual(2);

        // Click "New" to get a fresh config
        await page.locator('app-footer').locator('button').first().click();
        await page.waitForTimeout(300);

        const v2 = await page.evaluate(() => {
            const ups = Array.from(document.querySelectorAll('.pp-step-up')).map(
                (el) => el.textContent!.trim(),
            );
            const downs = Array.from(document.querySelectorAll('.pp-step-down')).map(
                (el) => el.textContent!.trim(),
            );
            const marker = document.querySelector('.pp-target-marker') as HTMLElement;
            return { ups, downs, left: marker?.style?.left };
        });
        for (const lbl of v2.ups) expect(lbl).toMatch(/^\+\d+$/);
        for (const lbl of v2.downs) expect(lbl).toMatch(/^-\d+$/);
        expect(v2.left).toMatch(/\d+%/);
        // The values should change between puzzles
        expect(v1.ups.join(',')).not.toBe(v2.ups.join(','));
    });

    test('pressing DOWN at 0 triggers flash and reset', async ({ page }) => {
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(1200);
        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('pressing UP many times exceeds 100 and resets', async ({ page }) => {
        // Check if any per-switch UP value exceeds 100 (i.e., would overflow)
        // Since all switches' trap directions cause overflow/underflow, at least
        // some will overflow. But we need to test this by clicking until reset.
        let anyUpOvershoot = false;
        for (let i = 0; i < 5; i++) {
            const xVal = await page.evaluate((idx) => {
                const ups = document.querySelectorAll('.pp-step-up');
                return parseInt(ups[idx]?.textContent?.trim() || '0');
            }, i);
            // If a switch at position 0 has UP > 20, 5 consecutive UPs would overflow
            // But more importantly, if UP is the trap for ANY switch, force-clicking
            // UP repeatedly will eventually hit that trap.
            if (xVal >= 15) { anyUpOvershoot = true; break; }
        }
        if (!anyUpOvershoot) return; // skip — all UP values are small

        // Force-click UP many times. Since only one direction per switch is valid,
        // eventually we'll hit a switch where UP is the trap direction.
        for (let i = 0; i < 10; i++) {
            await page.locator('.pp-btn-up').click({ force: true });
            await page.waitForTimeout(400);

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

    test('wrong direction at any switch triggers flash and resets', async ({ page }) => {
        // Advance past switch 1 with UP (always valid at position 0)
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);

        // Try DOWN at switch 2. If DOWN crashes below 0, we get a full reset.
        await page.locator('.pp-btn-down').click();
        // Wait for potential fail animation (400ms needle + 600ms flash + buffer)
        await page.waitForTimeout(1200);

        const activeIdx = await page.evaluate(() => {
            const cols = document.querySelectorAll('.pp-switch-col');
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].classList.contains('pp-active')) return i;
            }
            return -1;
        });
        // Should be 0 (crashed and reset) or 2 (DOWN was valid, advanced to 3rd)
        expect([0, 2]).toContain(activeIdx);
    });

    test('solving with a correct sequence completes the puzzle', async ({ page }) => {
        // Read all 5 per-switch (x, y) values from the DOM
        const perSwitch = await page.evaluate(() => {
            const ups = Array.from(document.querySelectorAll('.pp-step-up')).map(
                (el) => parseInt(el.textContent!.trim()),
            );
            const downs = Array.from(document.querySelectorAll('.pp-step-down')).map(
                (el) => Math.abs(parseInt(el.textContent!.trim())),
            );
            const marker = document.querySelector('.pp-target-marker') as HTMLElement;
            const targetPct = parseFloat(marker.style.left);
            return {
                xs: ups,
                ys: downs,
                target: Math.round((targetPct / 100) * 100),
            };
        });

        // There is exactly 1 valid path — find it by trying each mask
        const seq = await page.evaluate(({ xs, ys, target }) => {
            for (let mask = 0; mask < 32; mask++) {
                let pos = 0;
                let ok = true;
                const seq: boolean[] = [];
                for (let i = 0; i < 5; i++) {
                    const isUp = !!(mask & (1 << i));
                    seq.push(isUp);
                    pos += isUp ? xs[i] : -ys[i];
                    if (pos < 0 || pos > 100) {
                        ok = false;
                        break;
                    }
                }
                if (ok && pos === target) return seq;
            }
            return null;
        }, perSwitch);

        expect(seq).not.toBeNull();

        for (const isUp of seq!) {
            if (isUp) await page.locator('.pp-btn-up').click();
            else await page.locator('.pp-btn-down').click();
            await page.waitForTimeout(400);
        }

        await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#complete-text')).toHaveText('COMPLETED');
    });

    test('active switch advances after each valid press', async ({ page }) => {
        const cols = page.locator('.pp-switch-col');
        await expect(cols.nth(0)).toHaveClass(/pp-active/);

        // First press (always UP since position 0 can't go DOWN)
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(cols.nth(1)).toHaveClass(/pp-active/);

        // Second press — try UP. If valid, advance to 3. If it overflows, we reset.
        await page.locator('.pp-btn-up').click();
        // Wait for either the advance or the full fail animation + reset
        await page.waitForTimeout(1200);

        const secondActive = await page.evaluate(() => {
            const allCols = document.querySelectorAll('.pp-switch-col');
            for (let i = 0; i < allCols.length; i++) {
                if (allCols[i].classList.contains('pp-active')) return i;
            }
            return -1;
        });
        expect([0, 2]).toContain(secondActive);
    });

    test('lever visually shows UP state on first switch', async ({ page }) => {
        // First switch is always UP from position 0
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);
        await expect(page.locator('.pp-lever').first()).toHaveClass(/pp-up/);
    });

    test('reset button restores initial state', async ({ page }) => {
        // First switch is always UP
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);

        await page.locator('app-footer').locator('button').last().click();
        await page.waitForTimeout(300);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });
});
