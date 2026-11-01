import { test, expect } from '@playwright/test';

// Preview's "member" is a team participant; "participant" has not joined a team.
for (const role of ['leader', 'member']) {
  for (const width of [1440, 390, 320]) {
    test(`회차 버튼 안에서 평가 기간을 펼친다 (${role}, ${width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.addInitScript((role) => {
        localStorage.setItem('fairplay:preview-role', role);
      }, role);
      await page.goto('/preview/spaces/1/teams/1/peer-evaluations');

      const picker = page.getByRole('group', { name: '평가 회차 선택' });
      const mid = picker.getByRole('button', { name: /^중간 평가/ });
      const final = picker.getByRole('button', { name: /^최종 평가/ });
      await expect(final).toHaveAttribute('aria-expanded', 'false');
      await expect(mid).toHaveAttribute('aria-expanded', 'false');
      await final.click();
      await expect(final).toHaveAttribute('aria-expanded', 'true');
      const collapsedWidth = (await mid.boundingBox()).width;
      const finalDates = await final.locator('time').evaluateAll((items) => items.map((item) => item.dateTime));

      await mid.click();
      await expect(mid).toHaveAttribute('aria-expanded', 'true');
      await expect(final).toHaveAttribute('aria-expanded', 'false');
      await expect(mid.locator('.round-tab-details')).toBeVisible();
      await expect(mid.locator('time')).toHaveCount(2);
      await expect(mid.locator('.round-tab-details').getByText('시작', { exact: true })).toHaveCount(0);
      await expect(mid.locator('.round-tab-details').getByText('마감', { exact: true })).toHaveCount(0);
      await expect(mid.locator('time').first()).toHaveAttribute('aria-label', /^시작 /);
      await expect(mid.locator('time').last()).toHaveAttribute('aria-label', /^마감 /);
      const midDates = await mid.locator('time').evaluateAll((items) => items.map((item) => item.dateTime));
      expect(midDates.every(Boolean)).toBe(true);
      expect(midDates).not.toEqual(finalDates);
      if (width > 720) {
        await expect.poll(async () => (await mid.boundingBox()).width).toBeGreaterThan(collapsedWidth + 100);
        expect((await mid.boundingBox()).height).toBeLessThanOrEqual(40);
        const summaryBox = await mid.locator('.round-tab-summary').boundingBox();
        const scheduleBox = await mid.locator('.evaluation-round-context').boundingBox();
        expect(scheduleBox.x).toBeGreaterThan(summaryBox.x + summaryBox.width);
      }

      await mid.click();
      await expect(mid).toHaveAttribute('aria-expanded', 'false');
      await expect(mid).toHaveAttribute('aria-pressed', 'true');
      await expect(mid.locator('.round-tab-details')).toHaveCSS('visibility', 'hidden');
      if (width > 720) {
        await expect.poll(async () => (await mid.boundingBox()).width).toBeCloseTo(collapsedWidth, 0);
      }

      await final.focus();
      await final.press('Enter');
      await expect(final).toHaveAttribute('aria-expanded', 'true');
      await expect(mid).toHaveAttribute('aria-expanded', 'false');
      await expect(final.locator('.round-tab-details')).toHaveCSS('opacity', '1');
      await expect(mid.locator('.round-tab-details')).toHaveCSS('visibility', 'hidden');
      expect((await mid.boundingBox()).height).toBeLessThanOrEqual(40);

      const score = page.locator('.peer-target.is-active .score-field').first().getByRole('radio').nth(3);
      await score.check();
      await final.click();
      await expect(final).toHaveAttribute('aria-expanded', 'false');
      await expect(final).toHaveAttribute('aria-pressed', 'true');
      await expect(final.locator('.round-tab-details')).toHaveCSS('visibility', 'hidden');
      await expect(score).toBeChecked();
      await final.press('Enter');
      await expect(final).toHaveAttribute('aria-expanded', 'true');
      await expect(final.locator('.round-tab-details')).toHaveCSS('visibility', 'visible');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await picker.screenshot({ path: testInfo.outputPath('round-schedule.png') });
    });
  }
}

test('팀 미소속 참여자에게 동료 평가 접근 권한을 추가하지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fairplay:preview-role', 'participant');
  });
  await page.goto('/preview/spaces/1/teams/1/peer-evaluations');
  await expect(page.getByRole('heading', { name: '팀을 열 수 없습니다.' })).toBeVisible();
  await expect(page.getByRole('group', { name: '평가 회차 선택' })).toHaveCount(0);
});

test('모션 줄이기 설정에서는 일정 펼침과 접힘을 즉시 반영한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'leader'));
  await page.goto('/preview/spaces/1/teams/1/peer-evaluations');
  const final = page.getByRole('group', { name: '평가 회차 선택' }).getByRole('button', { name: /^최종 평가/ });
  await final.click();
  await expect(final).toHaveAttribute('aria-expanded', 'true');
  await expect(final.locator('.round-tab-details')).toHaveCSS('transition-duration', '0s');
  await final.click();
  await expect(final).toHaveAttribute('aria-expanded', 'false');
  await expect(final.locator('.round-tab-details')).toHaveCSS('visibility', 'hidden');
});
