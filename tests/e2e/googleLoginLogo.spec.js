import { test, expect } from '@playwright/test';

for (const width of [1440, 320]) {
  test(`${width}px Google 로그인 버튼에 컬러 로고와 문구를 가로 정렬한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
    );
    await page.goto('/login');
    const button = page.getByRole('button', {
      name: 'Google로 계속하기',
      exact: true,
    });
    await expect(button).toBeEnabled();
    const logo = button.locator('img');
    await expect(logo).toHaveAttribute('alt', '');
    await expect(logo).toHaveAttribute('aria-hidden', 'true');
    await expect
      .poll(() => logo.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    const icon = await logo.boundingBox();
    const label = await button.locator('span').boundingBox();
    expect(icon.width).toBe(20);
    expect(icon.height).toBe(20);
    expect(label.x - icon.x - icon.width).toBeCloseTo(10, 0);
    expect(
      Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2),
    ).toBeLessThanOrEqual(1);
    expect(
      await button.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  });
}

test('로그인 미리보기도 같은 로고와 비활성 상태를 유지한다', async ({
  page,
}) => {
  await page.goto('/preview/login');
  const button = page.getByRole('button', {
    name: 'Google 로그인 · 실제 서비스에서 연결',
    exact: true,
  });
  await expect(button).toBeDisabled();
  await expect(button.locator('img')).toBeVisible();
  await expect
    .poll(() =>
      button
        .locator('img')
        .evaluate((el) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
});
