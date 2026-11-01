import { test, expect } from '@playwright/test';

for (const role of ['leader', 'member']) {
  for (const width of [1440, 1024, 820, 390, 320]) {
    test(`저장 현황과 평가 입력을 정렬하고 설명을 자르지 않는다 (${role}, ${width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((role) => localStorage.setItem('fairplay:preview-role', role), role);
      await page.goto('/preview/spaces/1/teams/1/peer-evaluations');
      const progress = page.getByRole('region', { name: '내 평가 저장 현황' });
      const targetHeading = page.locator('.peer-target-heading');
      const sidebar = page.getByRole('complementary', { name: '평가 대상과 진행률' });
      const picker = page.getByRole('group', { name: '평가할 팀원 선택' });
      await expect(progress).toContainText('0 / 2명 저장');
      await expect(picker.getByRole('button')).toHaveCount(2);
      await expect(sidebar.getByText('저장 후 최종 제출이 필요합니다.')).toBeVisible();
      await expect(page.getByRole('progressbar', { name: '내 평가 작성 진행률' })).toHaveAttribute('aria-valuenow', '0');

      for (const text of [progress.locator('p'), targetHeading.locator('p'), sidebar.locator('.peer-progress-help')]) {
        const unclipped = await text.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1);
        expect(unclipped).toBe(true);
      }
      const leftBox = await progress.getByRole('heading').boundingBox();
      const rightBox = await targetHeading.getByRole('heading').boundingBox();
      const mainBox = await page.getByRole('main').boundingBox();
      expect(leftBox.x).toBeGreaterThanOrEqual(mainBox.x);
      if (width > 720) {
        expect(Math.abs(leftBox.y - rightBox.y)).toBeLessThan(1);
        const heading = page.locator('.peer-workspace-heading');
        await expect(heading).toHaveCSS('border-bottom-width', '1px');
        await expect(progress).toHaveCSS('border-bottom-width', '0px');
        const headerBox = await heading.boundingBox();
        const pickerBox = await sidebar.boundingBox();
        const formBox = await page.locator('.peer-target.is-active .peer-card').boundingBox();
        expect(Math.abs(pickerBox.y - formBox.y)).toBeLessThan(1);
        expect(formBox.y - (headerBox.y + headerBox.height)).toBeGreaterThanOrEqual(19);
      } else {
        const sidebarBox = await sidebar.boundingBox();
        expect(rightBox.y).toBeGreaterThan(sidebarBox.y + sidebarBox.height);
      }

      await picker.getByRole('button').nth(1).click();
      await expect(targetHeading.getByRole('heading')).toBeFocused();
      await expect(picker.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.peer-target.is-active .score-field')).toHaveCount(4);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('evaluation-layout.png') });
    });
  }
}
