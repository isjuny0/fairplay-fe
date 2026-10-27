import { test, expect } from '@playwright/test';

for (const role of ['member', 'manager']) {
  for (const width of [1440, 375]) {
    test(`${role} ${width}px 공지 메뉴는 스페이스 화면에만 표시하고 팀 화면에서는 숨긴다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => {
        localStorage.setItem('fairplay:preview-role', value);
      }, role);

      const sidebar = page.getByRole('navigation', { name: '스페이스 메뉴', exact: true });
      const announcements = sidebar.getByRole('button', { name: '공지사항', exact: true });
      const openSidebar = async () => {
        if (width <= 720) {
          await page.getByRole('button', { name: '스페이스 메뉴 펼치기', exact: true }).click();
        }
      };

      await page.goto('/preview/spaces/1');
      await expect(page.locator('.space-announcement-summary')).toBeVisible();
      await openSidebar();
      await expect(announcements).toBeVisible();
      await announcements.click();
      await expect(page).toHaveURL(/\/preview\/spaces\/1\/announcements$/);
      await expect(page.locator('.announcement-row').first()).toBeVisible();
      await openSidebar();
      await expect(announcements).toHaveAttribute('aria-current', 'page');

      await page.goto('/preview/spaces/1/announcements/1');
      await expect(page.locator('.announcement-content')).toBeVisible();
      await openSidebar();
      await expect(announcements).toBeVisible();
      await expect(announcements).toHaveAttribute('aria-current', 'page');

      for (const path of ['/teams/1', '/teams/1/tasks', '/teams/1/tasks/102', '/teams/1/deliverables']) {
        await page.goto(`/preview/spaces/1${path}`);
        await openSidebar();
        await expect(sidebar.getByRole('button', { name: '스페이스 홈', exact: true })).toBeVisible();
        await expect(announcements).toHaveCount(0);
        await sidebar.getByRole('button', { name: '스페이스 홈', exact: true }).click();
        await expect(page).toHaveURL(/\/preview\/spaces\/1$/);
        await expect(page.locator('.space-announcement-summary')).toBeVisible();
        await openSidebar();
        await expect(announcements).toBeVisible();
      }
    });
  }
}
