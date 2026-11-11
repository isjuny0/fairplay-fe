import { test, expect } from '@playwright/test';
import { dashboardWidgets } from '../../src/lib/teamDashboard.js';
import { clickDashboardControl } from './helpers/teamDashboard.js';

for (const width of [320, 390, 720, 721, 745, 900, 1000, 1024, 1440]) {
  test(`${width}px 실제 위젯 모양을 항목 호버·이름 선택으로 확인하고 선택 상태를 바꾸지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const mutations = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') mutations.push(request.url());
    });
    await page.goto('/preview/spaces/1/teams/1');
    await clickDashboardControl(page, '위젯 추가');
    const catalog = page.getByRole('dialog', { name: '위젯 추가', exact: true });
    await expect(catalog.locator('.lucide-eye')).toHaveCount(0);
    await expect(catalog.locator('.dashboard-catalog-preview-panel')).toHaveCount(0);
    const initialSelection = await catalog.locator('.dashboard-catalog-select').evaluateAll(items => items.map(item => item.getAttribute('aria-pressed')));
    for (const widget of dashboardWidgets) {
      const trigger = width > 720
        ? catalog.getByRole('button', { name: new RegExp(`^${widget.title} (추가|제거)$`) })
        : catalog.getByRole('button', { name: `${widget.title} 위젯 미리보기`, exact: true });
      if (width > 720) await trigger.hover();
      else await trigger.click();
      const preview = catalog.getByRole('region', { name: `${widget.title} 위젯 미리보기`, exact: true });
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('예시 화면');
      const box = await preview.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      await expect(preview.locator('.dashboard-card')).toBeVisible();
      await expect(preview.locator('.dashboard-title h2')).toHaveText(widget.title);
      await expect(preview.locator('.dashboard-preview-canvas')).toHaveAttribute('inert', '');
      await expect(preview.locator('.widget-example')).toHaveCount(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width > 720) {
        const popup = catalog.locator('.widget-catalog-hover-preview:popover-open');
        await expect(popup).toBeVisible();
        await expect(popup).toHaveCSS('position', 'fixed');
        const popupBox = await popup.boundingBox();
        expect(popupBox.x).toBeGreaterThanOrEqual(0);
        expect(popupBox.y).toBeGreaterThanOrEqual(0);
        expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(width);
        expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(844);
      } else {
        const item = await trigger.locator('..').boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(item.y + item.height);
      }
      // Close via keyboard before moving to another item so pointer position is irrelevant.
      await trigger.focus();
      await page.keyboard.press('Escape');
      await expect(preview).toHaveCount(0);
      await expect(catalog).toBeVisible();
    }
    if (width > 720) {
      await catalog.focus();
      await catalog.locator('.dashboard-catalog-whole-select').filter({ hasText: '캘린더' }).hover();
      await expect(catalog.locator('.widget-catalog-hover-preview:popover-open')).toHaveCount(1);
      await catalog.getByRole('heading', { name: '위젯 추가', exact: true }).hover();
      await expect(catalog.locator('.widget-catalog-hover-preview')).toHaveCount(0);
    }
    expect(await catalog.locator('.dashboard-catalog-select').evaluateAll(items => items.map(item => item.getAttribute('aria-pressed')))).toEqual(initialSelection);
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(catalog).toHaveCount(0);
    await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  });
}

for (const width of [390, 720, 721, 1440]) {
  test(`${width}px 위젯 선택은 데스크톱 항목 전체와 모바일 추가 버튼을 구분한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/preview/spaces/1/teams/1');
    await clickDashboardControl(page, '위젯 추가');
    const catalog = page.getByRole('dialog', { name: '위젯 추가', exact: true });
    const item = catalog.locator('.dashboard-catalog-item').filter({ has: page.getByText('다가오는 작업', { exact: true }) });
    const select = item.locator('.dashboard-catalog-select');
    await expect(select).toHaveAttribute('aria-pressed', 'false');
    if (width > 720) {
      const toggle = async (click, selected) => {
        await click();
        await expect(select).toHaveAttribute('aria-pressed', String(selected));
        await expect(select).toBeEnabled();
        await expect(catalog).toBeVisible();
      };
      await toggle(() => item.locator('strong').click(), true);
      await toggle(() => item.locator('small').click(), false);
      await toggle(() => item.locator('.dashboard-icon').click(), true);
      await toggle(() => select.click({ position: { x: 12, y: 12 } }), false);
      await toggle(() => item.locator('.dashboard-catalog-action').click(), true);
      await toggle(() => select.press('Space'), false);
      await toggle(() => select.press('Enter'), true);
    } else {
      await item.getByRole('button', { name: '다가오는 작업 위젯 미리보기', exact: true }).click();
      await expect(item.getByRole('region', { name: '다가오는 작업 위젯 미리보기', exact: true })).toBeVisible();
      await expect(select).toHaveAttribute('aria-pressed', 'false');
      await select.click();
      await expect(select).toHaveAttribute('aria-pressed', 'true');
    }
    await catalog.getByRole('button', { name: '완료', exact: true }).click();
    await expect(page.locator('.dashboard-widget.widget-upcoming')).toBeVisible();
    await expect(page.locator('.dashboard-edit-toggle')).toHaveAttribute('aria-pressed', 'true');
  });
}
