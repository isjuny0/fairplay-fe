import { test, expect } from '@playwright/test';

for (const width of [1440, 320]) {
  test(`${width}px 헤더 프로필은 팀원 프로필과 같은 회색 배경과 짙은 글씨를 사용한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/members');
    const profile = page.locator('.profile-avatar');
    const member = page.locator('.member-avatar').first();
    await expect(profile).toHaveText('김');
    await expect(member).toBeAttached();
    if (width > 720) await expect(member).toBeVisible();
    for (const name of [
      'background-color',
      'color',
      'border-top-color',
      'border-radius',
    ]) {
      const value = await member.evaluate(
        (element, property) =>
          getComputedStyle(element).getPropertyValue(property),
        name,
      );
      await expect(profile).toHaveCSS(name, value);
    }
    await expect(profile).toHaveCSS('background-color', 'rgb(238, 237, 233)');
    await expect(profile).toHaveCSS('color', 'rgb(32, 36, 43)');
    await expect(profile).toHaveCSS('width', '32px');
    await expect(profile).toHaveCSS('height', '32px');
    await expect(page.locator('.profile-name')).toHaveText('김하늘');
    await expect(
      page.getByRole('button', { name: '미리보기 종료', exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}
