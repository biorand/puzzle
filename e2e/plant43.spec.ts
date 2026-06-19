import { test, expect } from '@playwright/test';

test.describe('Plant 43 Puzzle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('repuzzles-progress', '10');
    });
    await page.goto('/#/re2r/plant-43');
    await page.waitForSelector('.plant43-stage');
  });

  test('renders all puzzle elements', async ({ page }) => {
    await expect(page.locator('.plant43-btn')).toHaveCount(3);
    await expect(page.locator('.plant43-target-line')).toBeVisible();
    await expect(page.locator('.plant43-tube-marker-label').first()).toBeVisible();

    const buttons = await page.$$eval('.plant43-btn .material-symbols-outlined', (els) =>
      els.map((el) => el.textContent!.trim()),
    );
    expect(buttons).toEqual(['arrow_downward', 'swap_horiz', 'sync_alt']);
  });

  test('puzzle resets after completion', async ({ page }) => {
    // Solve the puzzle
    const targetFill = await page.evaluate(() => {
      const line = document.querySelector('.plant43-target-line') as HTMLElement;
      const bottom = parseFloat(line.style.bottom);
      const tube = document.querySelector('.plant43-tube[data-slot="0"]');
      if (!tube) return 0;
      const glass = tube.querySelector('.plant43-tube-glass') as HTMLElement;
      const h = parseFloat(glass.style.height);
      const capMap: Record<number, number> = { 160: 7, 114: 5, 69: 3 };
      const cap = capMap[h] || 7;
      return Math.round(((bottom - 26) / h) * cap);
    });

    const startState = await page.evaluate(() => {
      const caps = [7, 5, 3];
      const glassH = [160, 114, 69];
      const fills: number[] = [];
      const bars = document.querySelectorAll('.plant43-tube-fill');
      bars.forEach((bar, i) => {
        const pct = parseFloat((bar as HTMLElement).style.height);
        const fillArea = glassH[i] - 4;
        fills.push(Math.round(((pct / 100) * glassH[i]) / fillArea * caps[i]));
      });
      return { fills, slots: [1, 0, 2] };
    });

    const solution = await page.evaluate(
      ({ fills, slots, target }: { fills: number[]; slots: number[]; target: number }) => {
        const CAP = [7, 5, 3];
        function key(s: number[], f: number[]): string {
          return s.join(',') + '|' + f.join(',');
        }
        function apply(s: number[], f: number[], action: string) {
          const ns = [...s];
          const nf = [...f];
          if (action === 'red') [ns[0], ns[1]] = [ns[1], ns[0]];
          else if (action === 'blue') [ns[1], ns[2]] = [ns[2], ns[1]];
          else if (action === 'green') {
            const amt = Math.min(nf[ns[1]], Math.max(0, CAP[ns[0]] - nf[ns[0]]));
            nf[ns[0]] += amt;
            nf[ns[1]] -= amt;
          }
          return { slots: ns, fills: nf };
        }
        const visited = new Set<string>();
        const queue: Array<{ slots: number[]; fills: number[]; path: string[] }> = [
          { slots, fills, path: [] },
        ];
        visited.add(key(slots, fills));
        while (queue.length > 0) {
          const cur = queue.shift()!;
          if (cur.fills[cur.slots[0]] === target) return cur.path;
          if (cur.path.length >= 20) continue;
          for (const a of ['red', 'blue', 'green']) {
            const next = apply(cur.slots, cur.fills, a);
            const k = key(next.slots, next.fills);
            if (!visited.has(k)) {
              visited.add(k);
              queue.push({ ...next, path: [...cur.path, a] });
            }
          }
        }
        return null;
      },
      { fills: startState.fills, slots: startState.slots, target: targetFill },
    );

    for (const action of solution!) {
      await page.click(`.plant43-btn.btn-${action}`);
      if (action === 'red' || action === 'blue') {
        await page.waitForTimeout(380);
      } else {
        await page.waitForTimeout(580);
      }
    }

    // Wait for overlay to appear and auto-dismiss (2s show + buffer)
    await expect(page.locator('#complete-overlay:not(.hidden)')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(4000);

    // After overlay closes, puzzle auto-resets with fresh layout
    await expect(page.locator('.plant43-stage')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.plant43-btn')).toHaveCount(3);

    // Click "New" button in footer — should generate another fresh puzzle
    await page.locator('#app-footer .action-btn').first().click();
    await page.waitForTimeout(300);

    await expect(page.locator('.plant43-stage')).toBeVisible();
    await expect(page.locator('.plant43-btn')).toHaveCount(3);
  });
});
