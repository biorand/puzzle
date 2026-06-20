import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#menu h1');
  });

  test('main menu has no back button', async ({ page }) => {
    const backBtn = page.locator('#back-btn');
    await expect(backBtn).not.toBeVisible();
  });

  test('vanilla run shows back button, clicking shows dialog with three options', async ({ page }) => {
    // Navigate to vanilla run
    await page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' }).click();
    await expect(page.locator('run-host')).toBeVisible();
    await page.waitForTimeout(500);

    // Back button should be visible
    const backBtn = page.locator('#back-btn');
    await expect(backBtn).toBeVisible();

    // Click back → quit dialog appears
    await backBtn.click();
    await expect(page.locator('.run-quit-dialog')).toBeVisible();
    await expect(page.locator('.run-quit-title')).toHaveText('Abandon Run?');

    // Dialog has three buttons
    const dialogBtns = page.locator('.run-quit-btn');
    await expect(dialogBtns).toHaveCount(3);
    await expect(dialogBtns.nth(0)).toHaveText('Continue');
    await expect(dialogBtns.nth(1)).toHaveText('Restart');
    await expect(dialogBtns.nth(2)).toHaveText('Quit');
  });

  test('dialog Continue dismisses dialog without leaving run', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' }).click();
    await page.waitForTimeout(500);

    await page.locator('#back-btn').click();
    await expect(page.locator('.run-quit-dialog')).toBeVisible();

    // Click Continue
    await page.locator('.run-quit-btn').filter({ hasText: 'Continue' }).click();
    await expect(page.locator('.run-quit-dialog')).not.toBeVisible();

    // Should still be in the run
    await expect(page.locator('run-host')).toBeVisible();
  });

  test('dialog Quit returns to menu', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' }).click();
    await page.waitForTimeout(500);

    await page.locator('#back-btn').click();
    await page.locator('.run-quit-btn').filter({ hasText: 'Quit' }).click();

    // Should be back on menu
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page).toHaveURL(/#\/?$/);
  });

  test('dialog Restart restarts the run from beginning', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' }).click();
    await page.waitForTimeout(500);

    // Make a move to advance state
    const cell = page.locator('.cell').first();
    await cell.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 1');

    // Open dialog and restart
    await page.locator('#back-btn').click();
    await page.locator('.run-quit-btn').filter({ hasText: 'Restart' }).click();
    await page.waitForTimeout(500);

    // Should be back on first config with 0 moves
    await expect(page.locator('run-host')).toBeVisible();
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 0');
    await expect(page.locator('.run-info-item').first()).toContainText('Config 1/3');
    await expect(page.locator('.run-info-item').nth(1)).toContainText('1 / 12');
  });

  test('random run shows back button and dialog same as vanilla', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'New Run' }).click();
    await expect(page.locator('run-host')).toBeVisible();
    await page.waitForTimeout(500);

    // Back button visible
    await expect(page.locator('#back-btn')).toBeVisible();

    // Dialog works
    await page.locator('#back-btn').click();
    await expect(page.locator('.run-quit-dialog')).toBeVisible();
    await expect(page.locator('.run-quit-btn').filter({ hasText: 'Continue' })).toBeVisible();
    await expect(page.locator('.run-quit-btn').filter({ hasText: 'Restart' })).toBeVisible();
    await expect(page.locator('.run-quit-btn').filter({ hasText: 'Quit' })).toBeVisible();
  });

  test('quick play shows back button, clicking returns to menu', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Quick Play' }).click();
    await expect(page.locator('puzzle-select')).toBeVisible();
    await expect(page.locator('#back-btn')).toBeVisible();

    // Click back → returns to menu
    await page.locator('#back-btn').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page).toHaveURL(/#\/?$/);
  });

  test('quick play clicking puzzle navigates to puzzle, back returns to quick play', async ({ page }) => {
    // Go to quick play
    await page.evaluate(() => (location.hash = '#/quickplay'));
    await page.waitForSelector('puzzle-select #menu-grid');

    // Click first puzzle (keypad, should be unlocked)
    await page.locator('.menu-card').first().click();
    await expect(page).toHaveURL(/#\/re1\/keypad/);

    // Back button returns to quick play
    await page.locator('#back-btn').click();
    await expect(page.locator('puzzle-select')).toBeVisible();
    await expect(page).toHaveURL(/#\/quickplay/);
  });

  test('results page back button returns to menu', async ({ page }) => {
    // Store a fake run result and navigate to results
    const fakeResult = {
      mode: 'vanilla',
      date: new Date().toISOString(),
      totalTime: 120,
      puzzles: [
        { puzzleId: 'keypad', configLabel: 'Config 1/3', moves: 1, optimal: 1, time: 10 },
        { puzzleId: 'keypad', configLabel: 'Config 2/3', moves: 2, optimal: 2, time: 15 },
        { puzzleId: 'keypad', configLabel: 'Config 3/3', moves: 3, optimal: 3, time: 20 },
        { puzzleId: 'vjolt', configLabel: 'Config 1/1', moves: 11, optimal: 11, time: 30 },
        { puzzleId: 'portableSafe', configLabel: 'Vanilla', moves: 6, optimal: 6, time: 15 },
        { puzzleId: 'powerPanel', configLabel: 'Vanilla', moves: 5, optimal: 5, time: 10 },
        { puzzleId: 'stagla', configLabel: 'Vanilla', moves: 7, optimal: 7, time: 20 },
        { puzzleId: 'graveyard', configLabel: 'Vanilla', moves: 3, optimal: 3, time: 10 },
        { puzzleId: 'slidingBlock', configLabel: 'Config 1/1', moves: 14, optimal: 14, time: 25 },
        { puzzleId: 'labPuzzle', configLabel: 'Config 1/1', moves: 5, optimal: 5, time: 15 },
        { puzzleId: 'plant43', configLabel: 'Config 1/2', moves: 8, optimal: 8, time: 20 },
        { puzzleId: 'plant43', configLabel: 'Config 2/2', moves: 10, optimal: 10, time: 25 },
      ],
      totalMoves: 75,
      totalOptimal: 75,
      rank: 'S+',
    };
    await page.evaluate((data) => {
      sessionStorage.setItem('repuzzles-run-result', JSON.stringify(data));
      location.hash = '#/run/results';
    }, fakeResult);

    await expect(page.locator('run-results')).toBeVisible();
    await expect(page.locator('.results-rank')).toHaveText('S+');

    // Back button returns to menu
    await page.locator('#back-btn').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page).toHaveURL(/#\/?$/);
  });

  test('results page Play Again re-starts same run mode', async ({ page }) => {
    const fakeResult = {
      mode: 'vanilla',
      date: new Date().toISOString(),
      totalTime: 60,
      puzzles: [
        { puzzleId: 'keypad', configLabel: 'Config 1/3', moves: 1, optimal: 1, time: 10 },
        { puzzleId: 'keypad', configLabel: 'Config 2/3', moves: 2, optimal: 2, time: 10 },
        { puzzleId: 'keypad', configLabel: 'Config 3/3', moves: 3, optimal: 3, time: 10 },
        { puzzleId: 'vjolt', configLabel: 'Config 1/1', moves: 11, optimal: 11, time: 10 },
        { puzzleId: 'portableSafe', configLabel: 'Vanilla', moves: 6, optimal: 6, time: 10 },
        { puzzleId: 'powerPanel', configLabel: 'Vanilla', moves: 5, optimal: 5, time: 10 },
        { puzzleId: 'stagla', configLabel: 'Vanilla', moves: 7, optimal: 7, time: 10 },
        { puzzleId: 'graveyard', configLabel: 'Vanilla', moves: 3, optimal: 3, time: 10 },
        { puzzleId: 'slidingBlock', configLabel: 'Config 1/1', moves: 14, optimal: 14, time: 10 },
        { puzzleId: 'labPuzzle', configLabel: 'Config 1/1', moves: 5, optimal: 5, time: 10 },
        { puzzleId: 'plant43', configLabel: 'Config 1/2', moves: 8, optimal: 8, time: 10 },
        { puzzleId: 'plant43', configLabel: 'Config 2/2', moves: 10, optimal: 10, time: 10 },
      ],
      totalMoves: 75,
      totalOptimal: 75,
      rank: 'S+',
    };
    await page.evaluate((data) => {
      sessionStorage.setItem('repuzzles-run-result', JSON.stringify(data));
      location.hash = '#/run/results';
    }, fakeResult);

    await expect(page.locator('run-results')).toBeVisible();

    // Click Play Again
    await page.locator('.results-btn-primary').click();
    await expect(page.locator('run-host')).toBeVisible();
  });

  test('vanilla run settings button opens settings, back returns to run', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Vanilla Run' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('run-host')).toBeVisible();

    // Click settings (gear) button
    await page.locator('#settings-btn').click();
    await expect(page.locator('settings-page')).toBeVisible();

    // Back returns to the run
    await page.locator('#back-btn').click();
    await expect(page.locator('run-host')).toBeVisible();
  });

  test('quick play has settings button, settings back returns to quick play', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Quick Play' }).click();
    await expect(page.locator('puzzle-select')).toBeVisible();

    // Settings button should be visible
    await expect(page.locator('#settings-btn')).toBeVisible();

    // Click settings
    await page.locator('#settings-btn').click();
    await expect(page.locator('settings-page')).toBeVisible();

    // Back returns to quick play
    await page.locator('#back-btn').click();
    await expect(page.locator('puzzle-select')).toBeVisible();
    await expect(page).toHaveURL(/#\/quickplay/);
  });

  test('puzzle page from quick play menu back goes to quick play, not main menu', async ({ page }) => {
    await page.locator('.menu-run-btn').filter({ hasText: 'Quick Play' }).click();
    await expect(page.locator('puzzle-select')).toBeVisible();

    // Click first puzzle
    await page.locator('.menu-card').first().click();
    await expect(page).toHaveURL(/#\/re1\/keypad/);

    // Back returns to quick play
    await page.locator('#back-btn').click();
    await expect(page.locator('puzzle-select')).toBeVisible();
    await expect(page).toHaveURL(/#\/quickplay/);

    // Back again returns to main menu
    await page.locator('#back-btn').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page).toHaveURL(/#\/?$/);
  });

  test('puzzle page from main menu back goes to main menu', async ({ page }) => {
    // Click first puzzle directly from menu
    await page.evaluate(() => (location.hash = '#/re1/keypad'));
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/re1\/keypad/);

    // Back returns to main menu
    await page.locator('#back-btn').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page).toHaveURL(/#\/?$/);
  });
});
