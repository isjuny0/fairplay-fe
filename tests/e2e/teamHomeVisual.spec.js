import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`${width}px 팀 홈은 작업 현황은 바로 보이고 계산 기준만 접혀 있다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    const home = page.locator('.team-home-visual');
    await expect(
      home.getByRole('heading', { name: '삼위일체', exact: true }),
    ).toBeVisible();
    const ring = home.getByRole('progressbar', {
      name: '예상 작업량을 반영한 팀 진행률',
    });
    await expect(ring).toHaveAttribute('aria-valuenow', '50');
    await expect(ring).toContainText('50.00%');
    await expect(home.locator('.home-work-metric')).toHaveCount(3);
    await expect(home.locator('.home-work-metric .progress-track')).toHaveCount(
      3,
    );
    await expect(home.locator('.home-work-metric > strong')).toHaveText([
      '70.00%',
      '40.00%',
      '57.14%',
    ]);
    await expect(home.locator('.home-definition-body')).toBeHidden();
    await expect(home.locator('.home-my-work')).toBeVisible();
    await expect(home.locator('.team-cover-strip, img')).toHaveCount(0);
    await expect(home.locator('.home-definitions > summary')).toBeVisible();
    for (const metric of await home.locator('.home-work-metric').all()) {
      await expect(metric).toHaveCSS('background-color', 'rgb(247, 250, 248)');
      await expect(metric.locator('.progress-track > span')).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    }
    for (const card of await home.locator('.home-action-link').all()) {
      const alignment = await card.evaluate((element) => {
        const parts = [
          '.home-action-icon > svg',
          '.home-action-title > span',
          '.home-action-title > strong',
          ':scope > .ui-icon',
        ].map((selector) =>
          element.querySelector(selector).getBoundingClientRect(),
        );
        return {
          centers: parts.map((part) => part.y + part.height / 2),
          ordered: parts.every(
            (part, index) => !index || part.left >= parts[index - 1].right,
          ),
        };
      });
      expect(
        Math.max(...alignment.centers) - Math.min(...alignment.centers),
      ).toBeLessThanOrEqual(1);
      expect(alignment.ordered).toBe(true);
    }
    await expect(
      home.getByText('내가 맡은 작업과 팀의 진행 상황을 확인하세요.'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    for (const selector of [
      '.home-action-title',
      '.home-work-metric',
      '.home-progress-ring',
    ]) {
      expect(
        await home
          .locator(selector)
          .evaluateAll((elements) =>
            elements.every(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          ),
      ).toBe(true);
    }
    if (width > 1100) {
      const progress = await home.locator('.home-team-progress').boundingBox();
      const actions = await home.locator('.home-actions').boundingBox();
      expect(progress.x + progress.width).toBeLessThan(actions.x);
      expect(progress.y).toBe(actions.y);
    }
  });
}

test('계산 기준은 키보드로 펼쳐 쉬운 설명과 계산식을 확인할 수 있다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  const body = page.locator('.home-definition-body');
  await expect(body).toBeHidden();
  const toggle = page.locator('.home-definitions > summary');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(body).toBeVisible();
  await expect(body).toContainText('팀 전체 일 중 내가 맡은 몫');
  await expect(body).toContainText('내가 맡은 일 중 얼마나 끝냈는지');
  await expect(body.getByRole('term')).toHaveCount(4);
  await expect(body).toContainText('내 담당 분량 ÷ 팀 전체 분량');
  await expect(body).toContainText('내 완료 분량 ÷ 내 담당 분량');
  await expect(body).toContainText('승인 대기 작업은 제외');
  await expect(body).toContainText(
    '최종 기여도 점수, 무임승차 여부를 뜻하지 않아요.',
  );
  await page.keyboard.press('Enter');
  await expect(body).toBeHidden();
  await expect(page.locator('.home-my-work')).toBeVisible();
});

test('평가와 리포트 바로가기는 기존 팀 메뉴로 연결된다', async ({ page }) => {
  await page.goto('/preview/spaces/1/teams/1');
  await page
    .getByRole('button', { name: '동료 평가 작성', exact: true })
    .click();
  await expect(page).toHaveURL(/\/peer-evaluations$/);
  await page.goBack();
  await page
    .getByRole('button', { name: '공개 리포트 보기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports$/);
});
