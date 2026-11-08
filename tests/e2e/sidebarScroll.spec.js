import { test, expect } from '@playwright/test';

for (const role of ['leader', 'manager']) {
  for (const width of [1440, 768, 390, 320]) {
    test(`${role} ${width}px: 메뉴만 스크롤하고 내 스페이스와 접기·닫기는 고정한다`, async ({ page }, testInfo) => {
      const mobile = width <= 720;
      // A short viewport deliberately makes even the smaller administrator menu scroll.
      await page.setViewportSize({ width, height: 420 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((previewRole) => {
        localStorage.setItem('fairplay:preview-role', previewRole);
        localStorage.removeItem('fairplay:workspace-sidebar-collapsed');
      }, role);
      await page.goto('/preview/spaces/1/teams/1/tasks');
      await expect(page.locator('main h1').first()).toBeVisible();
      const trigger = page.getByRole('button', { name: '스페이스 메뉴 펼치기', exact: true });
      if (mobile) await trigger.click();
      const sidebar = mobile
        ? page.getByRole('dialog', { name: '스페이스 메뉴', exact: true })
        : page.locator('.workspace > .workspace-sidebar');
      const back = sidebar.getByRole('button', { name: '내 스페이스', exact: true });
      const control = mobile
        ? sidebar.getByRole('button', { name: '메뉴 닫기', exact: true })
        : page.getByRole('button', { name: '사이드바 접기', exact: true });
      const menu = sidebar.locator('.workspace-navigation-links');
      await expect(back).toBeInViewport();
      await expect(control).toBeInViewport();
      const backBefore = await back.boundingBox();
      const controlBefore = await control.boundingBox();
      expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await menu.hover();
      await page.mouse.wheel(0, 1000);
      await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(menu.getByRole('button').last()).toBeInViewport();
      expect((await back.boundingBox()).y).toBeCloseTo(backBefore.y, 1);
      expect((await control.boundingBox()).y).toBeCloseTo(controlBefore.y, 1);
      expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(0);
      if (!mobile) {
        await page.locator('main h1').first().hover();
        await page.mouse.wheel(0, 800);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
        expect((await back.boundingBox()).y).toBeCloseTo(backBefore.y, 1);
        expect((await control.boundingBox()).y).toBeCloseTo(controlBefore.y, 1);
      }
      await page.screenshot({ path: testInfo.outputPath('fixed-sidebar-controls.png') });
      await control.click();
      if (mobile) {
        await expect(sidebar).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect(page.locator('#root')).not.toHaveAttribute('inert');
      } else {
        await expect(sidebar).toHaveClass(/is-collapsed/);
        await page.getByRole('button', { name: '사이드바 펼치기', exact: true }).click();
        await expect(back).toBeInViewport();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('모바일 내 스페이스 메뉴의 닫기도 목록 스크롤과 분리한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/preview/main');
  await page.getByRole('button', { name: '스페이스 메뉴', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '내 스페이스 메뉴', exact: true });
  const close = drawer.getByRole('button', { name: '메뉴 닫기', exact: true });
  const content = drawer.locator('.directory-sidebar-content');
  const before = await close.boundingBox();
  await content.hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await close.boundingBox()).y).toBeCloseTo(before.y, 1);
  await expect(content.getByRole('button').last()).toBeInViewport();
  await close.click();
  await expect(drawer).not.toBeVisible();
});
