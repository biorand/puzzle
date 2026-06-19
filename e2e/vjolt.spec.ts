import { test, expect } from '@playwright/test';

test.describe('V-JOLT Puzzle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('repuzzles-progress', '2');
    });
    await page.goto('/#/re1r/v-jolt');
    await page.waitForSelector('.vjolt-wall');
  });

  test('renders all puzzle elements', async ({ page }) => {
    await expect(page.locator('.vjolt-shelf-btn')).toHaveCount(3);
    await expect(page.locator('.vjolt-bottle')).toHaveCount(4);
    await expect(page.locator('.vjolt-btn')).toHaveCount(2);
    await expect(page.locator('.vjolt-btn-combine')).toBeVisible();
    await expect(page.locator('.vjolt-btn-discard')).toBeVisible();

    const eqs = await page.locator('.vjolt-equation').allTextContents();
    expect(eqs).toHaveLength(5);
    for (const eq of eqs) {
      expect(eq).toMatch(/^\d+\+\d+=\d+$/);
    }

    const legendItems = await page.locator('.vjolt-legend-entry').allTextContents();
    expect(legendItems).toHaveLength(3);
  });

  test('filling a bottle from shelf works', async ({ page }) => {
    const firstSlot = page.locator('.vjolt-bottle').first();
    await expect(firstSlot).toHaveClass(/empty/);

    await page.locator('.vjolt-shelf-btn').first().click();
    await expect(firstSlot).not.toHaveClass(/empty/);
  });

  test('combine two bottles via COMBINE button', async ({ page }) => {
    await page.locator('.vjolt-shelf-btn').nth(0).click();
    await page.locator('.vjolt-shelf-btn').nth(1).click();

    await page.locator('.vjolt-bottle').nth(0).click();
    await page.locator('.vjolt-bottle').nth(1).click();

    await page.locator('.vjolt-btn-combine').click();
    await page.waitForTimeout(300);

    const nonEmpty = page.locator('.vjolt-bottle:not(.empty)');
    await expect(nonEmpty).toHaveCount(1);
  });

  test('solve puzzle and verify completion', async ({ page }) => {
    // Read wall data and compute solve plan
    const solvePlan = await page.evaluate(() => {
      // Legend entries appear in shelf-button order: Water(0), red(1), yellow(2)
      const legendVals: number[] = [];
      for (const el of document.querySelectorAll('.vjolt-legend-entry')) {
        const valStr = (el.textContent || '').split('=')[1];
        legendVals.push(parseInt(valStr, 10));
      }

      const eqs: Array<{ left: number; right: number }> = [];
      for (const el of document.querySelectorAll('.vjolt-equation')) {
        const m = (el.textContent || '').match(/(\d+)\+(\d+)=\d+/);
        if (m) eqs.push({ left: +m[1], right: +m[2] });
      }

      const valueToShelfIdx: Record<number, number> = {};
      for (let i = 0; i < legendVals.length; i++) {
        valueToShelfIdx[legendVals[i]] = i;
      }

      const actions: Array<
        | { type: 'fill'; shelfIdx: number }
        | { type: 'combine'; valA: number; valB: number }
      > = [];
      const bench: number[] = [];

      function fillVal(v: number): void {
        const shelfIdx = valueToShelfIdx[v];
        if (shelfIdx !== undefined) {
          bench.push(v);
          actions.push({ type: 'fill', shelfIdx });
        }
      }

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

    // Execute the plan
    for (const action of solvePlan) {
      if (action.type === 'fill') {
        await page.locator('.vjolt-shelf-btn').nth(action.shelfIdx).click();
        await page.waitForTimeout(150);
      } else {
        // Find two bottles with values action.valA and action.valB
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
            const v = parseInt((txt || '').replace('#', ''), 10);

            if (v === targetVal) {
              positions.push(i);
              break;
            }
          }
        }

        await allBottles.nth(positions[0]).click();
        await page.waitForTimeout(120);
        await allBottles.nth(positions[1]).click();
        await page.waitForTimeout(120);

        await page.locator('.vjolt-btn-combine').click();
        await page.waitForTimeout(300);
      }
    }

    await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({
      timeout: 10000,
    });
  });
});
