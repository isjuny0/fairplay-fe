import { test, expect } from '@playwright/test';
import { dashboardWidgets } from '../../src/lib/teamDashboard.js';
import { clickDashboardControl } from './helpers/teamDashboard.js';

for (const width of [320, 390, 1440]) {
  test(`${width}px 위젯 예시는 호버·미리보기 버튼으로 확인하고 선택 상태를 바꾸지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const mutations = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') mutations.push(request.url());
    });
    await page.goto('/preview/spaces/1/teams/1');
    await clickDashboardControl(page, '위젯 추가');
    const catalog = page.getByRole('dialog', { name: '위젯 추가', exact: true });
    const initialSelection = await catalog.locator('.dashboard-catalog-select').evaluateAll(items => items.map(item => item.getAttribute('aria-pressed')));
    for (const widget of dashboardWidgets) {
      const trigger = catalog.getByRole('button', { name: `${widget.title} 위젯 미리보기`, exact: true });
      if (width === 1440) await trigger.hover();
      else await trigger.click();
      const preview = catalog.getByRole('tooltip', { name: `${widget.title} 위젯 미리보기`, exact: true });
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('예시 화면');
      const box = await preview.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      // Close via keyboard before moving to another item so pointer position is irrelevant.
      await trigger.focus();
      await page.keyboard.press('Escape');
      await expect(preview).toHaveCount(0);
      await expect(catalog).toBeVisible();
    }
    expect(await catalog.locator('.dashboard-catalog-select').evaluateAll(items => items.map(item => item.getAttribute('aria-pressed')))).toEqual(initialSelection);
    expect(mutations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(catalog).toHaveCount(0);
    await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  });
}
