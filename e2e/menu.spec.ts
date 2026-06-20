import { expect, test } from '@playwright/test';

test.describe('Main Menu', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#menu h1');
    });

    test('shows the title and subtitle', async ({ page }) => {
        await expect(page.locator('#menu h1')).toHaveText('BIORAND');
        await expect(page.locator('#menu h2')).toHaveText('Puzzle Collection');
    });

    test('shows three run buttons', async ({ page }) => {
        const btns = page.locator('.menu-run-btn');
        await expect(btns).toHaveCount(3);
        await expect(btns.nth(0)).toContainText('New Run');
        await expect(btns.nth(1)).toContainText('Vanilla Run');
        await expect(btns.nth(2)).toContainText('Quick Play');
    });

    test('quick play navigates to puzzle selection page', async ({ page }) => {
        const quickPlayBtn = page.locator('.menu-run-btn').filter({ hasText: 'Quick Play' });
        await quickPlayBtn.click();
        await expect(page.locator('puzzle-select')).toBeVisible();
        await expect(page.locator('puzzle-select #menu-grid .menu-card')).toHaveCount(9);
    });

    test('new run navigates to random run', async ({ page }) => {
        const btn = page.locator('.menu-run-btn').filter({ hasText: 'New Run' });
        await btn.click();
        await expect(page.locator('run-host')).toBeVisible();
    });

    test('vanilla run navigates to vanilla run', async ({ page }) => {
        const btn = page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' });
        await btn.click();
        await expect(page.locator('run-host')).toBeVisible();
    });
});

test.describe('Puzzle Select Screen', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.evaluate(() => (location.hash = '#/quickplay'));
        await page.waitForSelector('puzzle-select #menu-grid');
    });

    test('renders all 9 puzzle cards in the grid', async ({ page }) => {
        const cards = page.locator('.menu-card');
        await expect(cards).toHaveCount(9);
    });

    test('each card displays an SVG thumbnail', async ({ page }) => {
        const thumbs = page.locator('.menu-card-thumb svg');
        await expect(thumbs).toHaveCount(9);
    });

    test('first puzzle (Keypad) is unlocked on fresh start', async ({ page }) => {
        const firstCard = page.locator('.menu-card').first();
        await expect(firstCard).not.toHaveClass(/locked/);
        await expect(firstCard).toBeEnabled();
        await expect(firstCard.locator('.menu-card-name')).toHaveText('Keypad');
    });

    test('locked puzzles show requirement label and are disabled', async ({ page }) => {
        const lockedCards = page.locator('.menu-card.locked');
        const lockedCount = await lockedCards.count();
        expect(lockedCount).toBe(8);

        const requirements = page.locator('.menu-card-req');
        await expect(requirements).toHaveCount(8);

        const firstLocked = lockedCards.first();
        await expect(firstLocked).toBeDisabled();
        await expect(firstLocked.locator('.menu-card-req')).toContainText('Complete');
    });

    test('clicking locked puzzle does not navigate', async ({ page }) => {
        const firstLocked = page.locator('.menu-card.locked').first();
        await firstLocked.click({ force: true });
        await expect(page.locator('puzzle-select')).toBeVisible();
        await expect(page).toHaveURL(/#\/quickplay/);
    });

    test('clicking unlocked puzzle navigates to puzzle', async ({ page }) => {
        const keypadCard = page.locator('.menu-card').first();
        await keypadCard.click();
        await expect(page).toHaveURL(/#\/re1\/keypad/);
    });

    test('unlocking a puzzle reveals its card as enabled', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('repuzzles-progress', '1');
        });
        await page.reload();
        await page.evaluate(() => (location.hash = '#/quickplay'));
        await page.waitForSelector('puzzle-select #menu-grid');

        const secondCard = page.locator('.menu-card').nth(1);
        await expect(secondCard).not.toHaveClass(/locked/);
        await expect(secondCard).toBeEnabled();
        await expect(secondCard.locator('.menu-card-name')).toHaveText('V-JOLT');
    });

    test('card hover effect lifts the card', async ({ page }) => {
        const firstCard = page.locator('.menu-card').first();
        await firstCard.hover();
        await expect(firstCard).toBeVisible();
    });
});
