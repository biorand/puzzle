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
    await expect(page.locator('.vjolt-btn-test')).toBeVisible();
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

  test('combine two bottles and test', async ({ page }) => {
    await page.locator('.vjolt-shelf-btn').nth(0).click();
    await page.locator('.vjolt-shelf-btn').nth(1).click();

    await page.locator('.vjolt-bottle').nth(0).click();
    await expect(page.locator('.vjolt-bottle').nth(0)).toHaveClass(/selected/);

    await page.locator('.vjolt-bottle').nth(1).click();
    await page.waitForTimeout(300);

    const nonEmpty = page.locator('.vjolt-bottle:not(.empty)');
    await expect(nonEmpty).toHaveCount(1);
  });

  test('solve puzzle and verify completion', async ({ page }) => {
    // Read wall data and compute solve plan in page context
    const solvePlan = await page.evaluate(() => {
      const legend: Record<string, number> = {};
      for (const el of document.querySelectorAll('.vjolt-legend-entry')) {
        const [label, valStr] = (el.textContent || '').split('=');
        legend[label] = parseInt(valStr, 10);
      }

      const eqs: Array<{ left: number; right: number }> = [];
      for (const el of document.querySelectorAll('.vjolt-equation')) {
        const m = (el.textContent || '').match(/(\d+)\+(\d+)=\d+/);
        if (m) eqs.push({ left: +m[1], right: +m[2] });
      }

      const { Water, 'UMB #3': Red, 'Yel-6': Yellow } = legend;
      const valueToLabel: Record<number, string> = {};
      const labelToShelfIdx: Record<string, number> = {
        Water: 0,
        'UMB #3': 1,
        'Yel-6': 2,
      };
      for (const [label, val] of Object.entries(legend)) {
        valueToLabel[val] = label;
      }

      const actions: Array<
        { type: 'fill'; shelfIdx: number } | { type: 'combine' }
      > = [];
      const bench: number[] = [];

      function fillVal(v: number): void {
        const label = valueToLabel[v];
        if (label !== undefined) {
          bench.push(v);
          actions.push({ type: 'fill', shelfIdx: labelToShelfIdx[label] });
        }
      }

      for (const eq of eqs) {
        if (!bench.includes(eq.left)) fillVal(eq.left);
        if (!bench.includes(eq.right)) fillVal(eq.right);
        if (eq.left === eq.right) fillVal(eq.left);

        actions.push({ type: 'combine' });

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
        await page.waitForTimeout(100);
      } else {
        // Click any two non-empty bottles to auto-combine
        const positions: number[] = [];
        for (let i = 0; i < 4; i++) {
          const isE = await page
            .locator('.vjolt-bottle')
            .nth(i)
            .evaluate((el) => el.classList.contains('empty'));
          if (!isE) positions.push(i);
        }
        await page.locator('.vjolt-bottle').nth(positions[0]).click();
        await page.waitForTimeout(80);
        await page.locator('.vjolt-bottle').nth(positions[1]).click();
        await page.waitForTimeout(300);
      }
    }

    await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({
      timeout: 10000,
    });
  });
});
