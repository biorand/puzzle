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

        const label80 = page.locator('.pp-label.pp-80');
        await expect(label80).toHaveText('80');
        await expect(page.locator('.pp-label')).toHaveCount(11);
        await expect(page.locator('.pp-tick')).toHaveCount(11);

        await expect(page.locator('#pp-switches')).toBeVisible();
        await expect(page.locator('.pp-switch-col')).toHaveCount(5);
        await expect(page.locator('.pp-lever')).toHaveCount(5);
        await expect(page.locator('.pp-step-up')).toHaveCount(5);
        await expect(page.locator('.pp-step-down')).toHaveCount(5);

        const upLabels = await page.$$eval('.pp-step-up', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(upLabels).toEqual(['+36', '+36', '+36', '+36', '+36']);

        const downLabels = await page.$$eval('.pp-step-down', (els) =>
            els.map((el) => el.textContent!.trim()),
        );
        expect(downLabels).toEqual(['-14', '-14', '-14', '-14', '-14']);

        await expect(page.locator('#pp-actions')).toBeVisible();
        await expect(page.locator('.pp-action-btn')).toHaveCount(2);
        await expect(page.locator('.pp-btn-up')).toHaveText('▲ UP (+36)');
        await expect(page.locator('.pp-btn-down')).toHaveText('▼ DOWN (-14)');

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('UP button advances needle', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);

        // Needle position updates (can't check exact value since value label is removed)
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

    test('pressing DOWN at 0 triggers flash and reset', async ({ page }) => {
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(1200);

        // After reset, first switch should be active again
        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('pressing UP three times exceeds 100 and resets', async ({ page }) => {
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(1200);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('wrong final value (not 80) triggers flash and resets', async ({ page }) => {
        // U, U, D, D, D → 0→36→72→58→44→30 → stays in bounds, ends at 30 ≠ 80
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(800);

        await expect(page.locator('.pp-switch-col').first()).toHaveClass(/pp-active/);
    });

    test('winning sequence U,D,D,U,U completes the puzzle', async ({ page }) => {
        // U, D, D, U, U → 0→36→22→8→44→80
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-down').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(400);
        await page.locator('.pp-btn-up').click();
        await page.waitForTimeout(500);

        await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({ timeout: 8000 });
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
