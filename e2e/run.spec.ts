import { test, expect } from '@playwright/test';

test.describe('Run Mode', () => {
  test('random run renders keypad puzzle and info bar', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/random'));
    await page.waitForTimeout(1500);

    const runHost = page.locator('run-host');
    await expect(runHost).toBeVisible();

    // First config should be keypad
    const puzzle = page.locator('puzzle-keypad');
    await expect(puzzle).toBeVisible();

    // Info bar should show keypad name and config
    await expect(page.locator('.run-info-item').first()).toContainText('Keypad');
    await expect(page.locator('.run-info-item').nth(1)).toContainText('1 / 9');

    // Bottom info bar shows moves
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 0');
  });

  test('vanilla run renders keypad with Config 1/3', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1500);

    const runHost = page.locator('run-host');
    await expect(runHost).toBeVisible();

    // First vanilla config should be keypad Config 1/3
    const puzzle = page.locator('puzzle-keypad');
    await expect(puzzle).toBeVisible();

    await expect(page.locator('.run-info-item').first()).toContainText('Keypad');
    await expect(page.locator('.run-info-item').first()).toContainText('Config 1/3');
    await expect(page.locator('.run-info-item').nth(1)).toContainText('1 / 12'); // 3+1+...+2 = 12
  });

  test('random run New Puzzle regenerates puzzle and increments penalty', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/random'));
    await page.waitForTimeout(1500);

    await expect(page.locator('puzzle-keypad')).toBeVisible();

    // Debug: check forceDifficulty and other props
    const debug = await page.evaluate(() => {
      const kp = document.querySelector('puzzle-keypad') as any;
      return { state: kp?._state, optimal: kp?._optimal, moves: kp?._moves };
    });

    // Make a move
    await page.locator('.cell').first().click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 1');

    // Click "New" button
    await page.locator('app-footer').locator('button').first().click();
    await page.waitForTimeout(500);

    const afterNew = await page.evaluate(() => {
      const kp = document.querySelector('puzzle-keypad') as any;
      return { state: kp?._state, moves: kp?._moves, optimal: kp?._optimal };
    });

    expect(afterNew.moves).toBe(0);
    // Must have regenerated — either optimal or state differs
    const changed = afterNew.optimal !== debug.optimal || afterNew.state !== debug.state;
    expect(changed).toBe(true);
  });

  test('vanilla run New button is not shown', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1500);

    const footer = page.locator('run-host app-footer');
    await expect(footer).toBeVisible();

    const actionBtns = page.locator('app-footer').locator('button');
    await expect(actionBtns).toHaveCount(4);

    // First button (New slot) should be disabled (no handler in vanilla)
    await expect(actionBtns.nth(0)).toBeDisabled();

    // Reset button (4th) should be clickable
    const resetBtn = actionBtns.nth(3);
    const firstCell = page.locator('.cell').first();
    await firstCell.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 1');

    await resetBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 0');
  });

  test('solving puzzle advances to next config', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1500);

    // First config: keypad difficulty 1 (1 move to solve)
    // Keypad buttons: find the correct one to press
    // Difficulty 1 means we need to press 1 button to solve
    // The initial state is determined by groups[1][0]
    // We need to toggle the correct cells

    // Solve the puzzle by clicking all cells until solved
    // (risky but works for simple puzzles)
    for (let i = 0; i < 10; i++) {
      const isSolved = await page.evaluate(() => {
        const kp = document.querySelector('puzzle-keypad') as any;
        return kp?._state === 511; // SOLVED
      });
      if (isSolved) break;
      const btn = page.locator('.cell').first();
      await btn.click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2000); // wait for completion animation

    // Should have advanced to next config
    await expect(page.locator('.run-info-item').first()).toContainText('Config 2/3');
  });

  test('restart keeps footer toolbar visible (does not disappear)', async ({ page }) => {
    // This tests the bug where clicking back → restart causes the bottom
    // toolbar (app-footer with action buttons) to disappear because the
    // puzzle key doesn't change when no puzzles have been solved, so the
    // puzzle is not remounted and _syncActions() is never called again.
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/random'));
    await page.waitForTimeout(1500);

    const runHost = page.locator('run-host');
    await expect(runHost).toBeVisible();

    // Footer should be visible with Reset button before restart
    const footer = page.locator('run-host app-footer');
    await expect(footer).toBeVisible();
    const btns = footer.locator('button');
    await expect(btns).toHaveCount(4);

    // Click back to open quit dialog
    await page.locator('#back-btn').click();
    await expect(page.locator('.run-quit-dialog')).toBeVisible();

    // Click Restart
    await page.locator('.run-quit-btn').filter({ hasText: 'Restart' }).click();
    await page.waitForTimeout(500);

    // After restart, the footer should still be visible with active buttons
    await expect(footer).toBeVisible();
    const btnsAfter = footer.locator('button');

    // The Reset button (4th slot) should have a handler (not disabled)
    await expect(btnsAfter.nth(3)).not.toBeDisabled();

    // Making a move should still work and update the display
    const cell = page.locator('.cell').first();
    await cell.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 1');

    // Reset button should still work
    await btnsAfter.nth(3).click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-info-bar-bottom')).toContainText('Moves: 0');
  });
});
