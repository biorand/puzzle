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
    await expect(page.locator('.run-info-item').nth(1)).toContainText('1 / 10');

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
    await expect(page.locator('.run-info-item').nth(1)).toContainText('1 / 13'); // 3+1+...+2+1 = 13
  });

  test('random run New Puzzle regenerates puzzle and increments penalty', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/random'));
    await page.waitForTimeout(1500);

    await expect(page.locator('puzzle-keypad')).toBeVisible();

    // Force a harder puzzle so the first click cannot solve it accidentally,
    // which would disable the toolbar while it completes
    await page.evaluate(() => {
      const kp = document.querySelector('puzzle-keypad') as any;
      kp.forceDifficulty = 4;
      kp.regenerate();
    });
    await page.waitForTimeout(100);

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

  test('completing a puzzle in a run unlocks it for quick play', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1200);

    // Configs 1-3 are keypads of difficulty 1, 2 and 3
    const nextLabels = ['Config 2/3', 'Config 3/3', 'V-JOLT'];
    for (let config = 0; config < 3; config++) {
      await expect(page.locator('puzzle-keypad')).toBeVisible();
      const clicks = await page.evaluate(() => {
        const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
        const el = document.querySelector('puzzle-keypad') as any;
        const start = el._state;
        const prev = new Map<number, [number, number] | null>([[start, null]]);
        const q = [start];
        while (q.length) {
          const cur = q.shift()!;
          if (cur === 0x1ff) break;
          for (let i = 0; i < 9; i++) {
            const next = cur ^ MASKS[i];
            if (!prev.has(next)) {
              prev.set(next, [cur, i]);
              q.push(next);
            }
          }
        }
        const list: number[] = [];
        let cur = 0x1ff;
        while (prev.get(cur)) {
          const [p, i] = prev.get(cur)!;
          list.push(i);
          cur = p;
        }
        return list.reverse();
      });
      for (const idx of clicks) {
        await page.locator(`.cell[data-idx="${idx}"]`).click();
        await page.waitForTimeout(60);
      }
      await expect(page.locator('.run-info-item').first()).toContainText(nextLabels[config], {
        timeout: 10000,
      });
    }

    // Config 4 is V-JOLT
    await expect(page.locator('.vjolt-wall')).toBeVisible();
    const solvePlan = await page.evaluate(() => {
      const legendVals: number[] = [];
      for (const el of document.querySelectorAll('.vjolt-legend-entry')) {
        legendVals.push(parseInt((el.textContent || '').split('=')[1], 10));
      }
      const eqs: Array<{ left: number; right: number }> = [];
      for (const el of document.querySelectorAll('.vjolt-equation')) {
        const m = (el.textContent || '').match(/(\d+)\+(\d+)=\d+/);
        if (m) eqs.push({ left: +m[1], right: +m[2] });
      }
      const valueToShelfIdx: Record<number, number> = {};
      for (let i = 0; i < legendVals.length; i++) valueToShelfIdx[legendVals[i]] = i;

      const actions: Array<
        { type: 'fill'; shelfIdx: number } | { type: 'combine'; valA: number; valB: number }
      > = [];
      const bench: number[] = [];
      const fillVal = (v: number): void => {
        const shelfIdx = valueToShelfIdx[v];
        if (shelfIdx !== undefined) {
          bench.push(v);
          actions.push({ type: 'fill', shelfIdx });
        }
      };
      for (const eq of eqs) {
        if (!bench.includes(eq.left)) fillVal(eq.left);
        if (!bench.includes(eq.right)) fillVal(eq.right);
        if (eq.left === eq.right) fillVal(eq.left);
        actions.push({ type: 'combine', valA: eq.left, valB: eq.right });
        const li = bench.indexOf(eq.left);
        if (li >= 0) bench.splice(li, 1);
        const ri = bench.indexOf(eq.right);
        if (ri >= 0) bench.splice(ri, 1);
        bench.push(eq.left + eq.right);
      }
      return actions;
    });

    for (const action of solvePlan) {
      if (action.type === 'fill') {
        await page.locator('.vjolt-shelf-btn').nth(action.shelfIdx).click();
        await page.waitForTimeout(120);
      } else {
        const allBottles = page.locator('.vjolt-bottle');
        const positions: number[] = [];
        for (const targetVal of [action.valA, action.valB]) {
          for (let i = 0; i < 4; i++) {
            if (positions.includes(i)) continue;
            const isE = await allBottles
              .nth(i)
              .evaluate((el) => el.classList.contains('empty'));
            if (isE) continue;
            const txt = await allBottles
              .nth(i)
              .locator('.vjolt-bottle-value')
              .textContent();
            if (parseInt((txt || '').replace('#', ''), 10) === targetVal) {
              positions.push(i);
              break;
            }
          }
        }
        await allBottles.nth(positions[0]).click();
        await page.waitForTimeout(80);
        await allBottles.nth(positions[1]).click();
        await page.waitForTimeout(80);
        await page.locator('.vjolt-btn-combine').click();
        await page.waitForTimeout(200);
      }
    }

    await expect(page.locator('.run-info-item').first()).toContainText('Portable Safe', {
      timeout: 10000,
    });

    // Keypad and V-JOLT are now unlocked for Quick Play, Portable Safe is still locked
    const unlocked = await page.evaluate(
      () => JSON.parse(localStorage.getItem('repuzzles-unlocked') || '[]') as string[],
    );
    expect(unlocked.sort()).toEqual(['keypad', 'vjolt']);

    await page.locator('#back-btn').click();
    await page.locator('.run-quit-btn-quit').click();
    await page.evaluate(() => (location.hash = '#/quickplay'));
    await page.waitForSelector('puzzle-select #menu-grid');

    await expect(page.locator('.menu-card[data-id="keypad"]')).not.toHaveClass(/locked/);
    await expect(page.locator('.menu-card[data-id="vjolt"]')).not.toHaveClass(/locked/);
    await expect(page.locator('.menu-card[data-id="portableSafe"]')).toHaveClass(/locked/);
    await expect(
      page.locator('.menu-card[data-id="portableSafe"] .menu-card-req'),
    ).toHaveText('🔒 Complete in a run');
  });

  test('layout stays stable while a puzzle completes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1200);
    await expect(page.locator('puzzle-keypad')).toBeVisible();

    const before = await page.evaluate(() => ({
      footerH: document.querySelector('app-footer')!.getBoundingClientRect().height,
      puzzleH: document.querySelector('puzzle-keypad')!.getBoundingClientRect().height,
      barH: document.querySelector('.run-info-bar-bottom')!.getBoundingClientRect().height,
      padding: getComputedStyle(document.querySelector('puzzle-keypad')!).paddingTop,
    }));

    // Remember the element, solve config 1
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
      const resetLabel = buttons[3].querySelector('.btn-label') as HTMLElement;
      return {
        playing: puzzle._playing,
        footerH: footerEl.getBoundingClientRect().height,
        puzzleH: puzzle.getBoundingClientRect().height,
        barH: document.querySelector('.run-info-bar-bottom')!.getBoundingClientRect().height,
        resetDisabled: buttons[3].disabled,
        resetLabelDisplay: getComputedStyle(resetLabel).display,
        resetOpacity: getComputedStyle(buttons[3]).opacity,
      };
    });

    expect(during.playing).toBe(true);
    expect(Math.abs(during.footerH - before.footerH)).toBeLessThanOrEqual(1);
    expect(Math.abs(during.puzzleH - before.puzzleH)).toBeLessThanOrEqual(1);
    expect(Math.abs(during.barH - before.barH)).toBeLessThanOrEqual(1);
    expect(during.resetDisabled).toBe(true);
    // The button dims but keeps its layout
    expect(during.resetLabelDisplay).not.toBe('none');
    expect(parseFloat(during.resetOpacity)).toBeLessThan(1);
    // Puzzle content stays clear of the surrounding bars
    expect(before.padding).toBe('4px');
  });

  test('reset is inert during completion and cannot corrupt the result', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/vanilla'));
    await page.waitForTimeout(1500);
    await expect(page.locator('puzzle-keypad')).toBeVisible();

    // Vanilla config 1 is a forced 1-move keypad puzzle
    const cellIdx = await page.evaluate(() => {
      const MASKS = [0x00b, 0x017, 0x026, 0x059, 0x0ba, 0x134, 0x0c8, 0x1d0, 0x1a0];
      const kp = document.querySelector('puzzle-keypad') as any;
      for (let i = 0; i < 9; i++) if ((kp._state ^ MASKS[i]) === 0x1ff) return i;
      return -1;
    });
    expect(cellIdx).toBeGreaterThanOrEqual(0);
    await page.locator(`.cell[data-idx="${cellIdx}"]`).click();

    // During the completion animation the footer buttons must be inert
    await expect(page.locator('app-footer button').nth(3)).toBeDisabled({ timeout: 1500 });

    // The run must advance to config 2 with the real move count recorded
    await expect(page.locator('.run-info-item').first()).toContainText('Config 2/3', {
      timeout: 8000,
    });
    const firstResult = await page.evaluate(
      () => (document.querySelector('run-host') as any)._results[0],
    );
    expect(firstResult.moves).toBe(1);
    expect(firstResult.optimal).toBe(1);
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

  test('reset in run settings clears game data without a native confirm', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#/run/random'));
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      localStorage.setItem('repuzzles-unlocked', JSON.stringify(['keypad']));
      localStorage.setItem('other-key', 'keep');
    });

    await page.locator('#settings-btn').click();
    await expect(page.locator('settings-page')).toBeVisible();

    let dialogSeen = false;
    page.on('dialog', async (d) => {
      dialogSeen = true;
      await d.dismiss();
    });

    await page.locator('#settings-reset-btn').click(); // arm
    await page.locator('#settings-reset-btn').click(); // confirm
    await page.waitForTimeout(300);

    expect(dialogSeen).toBe(false);

    const state = await page.evaluate(() => ({
      unlocked: localStorage.getItem('repuzzles-unlocked'),
      other: localStorage.getItem('other-key'),
      onRun: !!document.querySelector('run-host'),
      onSettings: !!document.querySelector('settings-page'),
    }));
    expect(state.unlocked).toBeNull();
    expect(state.other).toBe('keep');
    expect(state.onRun).toBe(true);
    expect(state.onSettings).toBe(false);
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
