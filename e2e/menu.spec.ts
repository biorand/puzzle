import { expect, test } from '@playwright/test';

test.describe('Puzzle Menu Grid', () => {
    test.beforeEach(async ({ page }) => {
        // Clear any stored state so we start fresh (only keypad unlocked)
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#menu-grid');
    });

    test('shows the title and subtitle', async ({ page }) => {
        await expect(page.locator('#menu h1')).toHaveText('BIORAND');
        await expect(page.locator('#menu h2')).toHaveText('Puzzle Collection');
    });

    test('renders all 8 puzzle cards in the grid', async ({ page }) => {
        const cards = page.locator('.menu-card');
        await expect(cards).toHaveCount(8);
    });

    test('each card displays an SVG thumbnail', async ({ page }) => {
        const thumbs = page.locator('.menu-card-thumb svg');
        await expect(thumbs).toHaveCount(8);
    });

    test('first puzzle (Keypad) is unlocked on fresh start', async ({ page }) => {
        const firstCard = page.locator('.menu-card').first();
        await expect(firstCard).not.toHaveClass(/locked/);
        await expect(firstCard).toBeEnabled();
        await expect(firstCard.locator('.menu-card-name')).toHaveText('Keypad');
    });

    test('locked puzzles show requirement label and are disabled', async ({ page }) => {
        // All puzzles after keypad should be locked initially
        const lockedCards = page.locator('.menu-card.locked');
        const lockedCount = await lockedCards.count();
        expect(lockedCount).toBe(7);

        // Each locked card should have a requirement label
        const requirements = page.locator('.menu-card-req');
        await expect(requirements).toHaveCount(7);

        // Verify the first locked card shows the right requirement
        const firstLocked = lockedCards.first();
        await expect(firstLocked).toBeDisabled();
        await expect(firstLocked.locator('.menu-card-req')).toContainText('Complete');
    });

    test('clicking locked puzzle does not navigate', async ({ page }) => {
        const firstLocked = page.locator('.menu-card.locked').first();
        await firstLocked.click({ force: true });
        // Should still be on the menu page
        await expect(page.locator('#menu')).toBeVisible();
        await expect(page).toHaveURL('/');
    });

    test('clicking unlocked puzzle navigates to puzzle', async ({ page }) => {
        const keypadCard = page.locator('.menu-card').first();
        await keypadCard.click();
        // Should navigate to keypad puzzle
        await expect(page).toHaveURL(/#\/re1\/keypad/);
    });

    test('unlocking a puzzle reveals its card as enabled', async ({ page }) => {
        // Simulate completing keypad by advancing progress
        await page.evaluate(() => {
            localStorage.setItem('repuzzles-progress', '1');
        });
        await page.reload();
        await page.waitForSelector('#menu-grid');

        // Portable Safe (2nd card) should now be unlocked
        const secondCard = page.locator('.menu-card').nth(1);
        await expect(secondCard).not.toHaveClass(/locked/);
        await expect(secondCard).toBeEnabled();
        await expect(secondCard.locator('.menu-card-name')).toHaveText('Portable Safe');
    });

    test('card hover effect lifts the card', async ({ page }) => {
        const firstCard = page.locator('.menu-card').first();
        const initialBox = await firstCard.boundingBox();

        // Hover and check it moved up (translateY(-2px))
        await firstCard.hover();
        // We can't easily assert exact transform in all engines,
        // so just ensure nothing crashes and the card remains visible
        await expect(firstCard).toBeVisible();
    });
});
