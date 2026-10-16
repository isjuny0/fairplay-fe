import { test, expect } from '@playwright/test';
import { fillDateTime } from './helpers/dateTime.js';

async function openManagerPreview(page, path, scenario = 'active') {
  await page.goto('/preview/main');
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByText('미리보기 설정', { exact: true }).click();
  await page.getByLabel('미리보기 역할').selectOption('manager');
  await page.getByLabel('미리보기 상황').selectOption(scenario);
  await page.goto(`/preview${path}`);
}

for (const width of [1440, 390]) {
  test(`관리자는 ${width}px에서 팀 현황을 선택하고 주소를 복원한 뒤 전체 팀으로 돌아간다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/dashboard');
    const summary = page.getByRole('region', {
      name: '조회 범위의 작업 현황',
      exact: true,
    });
    await expect(summary.getByText('2건', { exact: true })).toHaveCount(3);
    if (width > 720)
      await page
        .getByRole('button', { name: '삼위일체 현황 보기', exact: true })
        .click();
    else await page.getByRole('button', { name: /^삼위일체 지연/ }).click();
    await expect(page).toHaveURL(/teamId=1/);
    await expect(page.getByLabel('조회할 팀')).toHaveValue('1');
    await expect(
      page.getByRole('heading', { name: '삼위일체 현황', exact: true }),
    ).toBeVisible();
    await expect(summary.getByText('1건', { exact: true })).toHaveCount(3);
    await expect(
      page.getByText('스페이스 전체 · 2팀 · 팀 미소속 0명', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: '삼위일체 · 팀원 수행 현황',
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('조회할 팀')).toHaveValue('1');
    await page
      .getByRole('button', { name: '전체 팀 보기', exact: true })
      .click();
    await expect(page.getByLabel('조회할 팀')).toHaveValue('');
    expect(new URL(page.url()).searchParams.has('teamId')).toBe(false);
    await expect(
      page.getByRole('heading', { name: '전체 팀 현황', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /팀원 수행 현황/ }),
    ).toHaveCount(0);
  });
}

test('팀 빌딩 기간은 저장된 값과 저장 전 입력을 구분하고 저장한 후 현재 기간을 갱신한다', async ({
  page,
}) => {
  await openManagerPreview(page, '/spaces/1/settings', 'building');
  const currentPeriod = page.getByLabel('저장된 팀 빌딩 기간', { exact: true });
  const storedText = await currentPeriod.textContent();
  await fillDateTime(page, '팀 빌딩 시작', '2026-09-01T10:00');
  await expect(currentPeriod).toHaveText(storedText);
  await expect(
    page.getByRole('status').filter({ hasText: '저장 전 입력' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '팀 빌딩 기간을 저장했습니다.' }),
  ).toBeVisible();
  await expect(currentPeriod).toContainText('2026. 09. 01. 10:00');
  await expect(
    page.getByRole('status').filter({ hasText: '저장 전 입력' }),
  ).toHaveCount(0);
});
