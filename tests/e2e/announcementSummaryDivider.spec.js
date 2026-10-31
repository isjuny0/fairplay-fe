import { test, expect } from '@playwright/test';

for (const role of ['leader', 'member', 'participant', 'manager']) {
  for (const width of [1440, 320]) {
    test(`스페이스 공지 하단 구분선은 하나만 표시한다 (${role}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((role) => {
        localStorage.setItem('fairplay:preview-role', role);
      }, role);
      await page.goto('/preview/spaces/1');

      const summary = page.locator('.space-announcement-summary');
      const board = summary.locator('.announcement-board');
      const rows = board.locator('.announcement-row');
      await expect(board).toBeVisible();
      await expect(rows).toHaveCount(2);
      await expect(summary).toHaveCSS('border-bottom-width', '0px');
      await expect(summary).toHaveCSS('padding-bottom', '0px');
      await expect(board).toHaveCSS('border-bottom-width', '1px');
      await expect(rows.first()).toHaveCSS('border-bottom-width', '1px');
      await expect(rows.last()).toHaveCSS('border-bottom-width', '0px');

      const bottomGap = await summary.evaluate((element) => (
        element.getBoundingClientRect().bottom
        - element.querySelector('.announcement-board').getBoundingClientRect().bottom
      ));
      expect(Math.abs(bottomGap)).toBeLessThan(1);
    });
  }
}
