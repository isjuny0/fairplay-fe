import { expect, test } from '@playwright/test';

async function enterPreview(page) {
  const networkApiCalls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) networkApiCalls.push(request.url());
  });
  await page.goto('/preview/main');
  await expect(page.getByRole('button', { name: '알림함' })).toBeVisible();
  return networkApiCalls;
}

test('헤더 알림 미리보기는 최근 접근 가능 항목을 표시하고 읽은 뒤 알림함으로 이동한다', async ({ page }) => {
  const calls = await enterPreview(page);
  await expect(page.getByRole('button', { name: '알림함' })).toContainText('3');
  await page.getByRole('button', { name: '알림함' }).click();
  await expect(page.getByRole('region', { name: '최근 알림' })).toBeVisible();
  await expect(page.getByText('더 이상 접근할 수 없는 항목입니다')).toHaveCount(0);
  await page.getByRole('button', { name: /새 작업에 배정되었습니다/ }).click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/102$/);
  expect(calls).toEqual([]);
});

test('알림함은 전체·미읽음 커서 목록과 전체 읽음을 제공한다', async ({ page }) => {
  const calls = await enterPreview(page);
  await page.goto('/preview/notifications');
  await expect(page.getByRole('heading', { name: '알림함', exact: true })).toBeVisible();
  await expect(page.getByText('더 이상 접근할 수 없는 항목입니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '열기' })).toHaveCount(3);
  await page.getByRole('button', { name: '읽지 않음' }).click();
  await expect(page.getByRole('button', { name: '읽음', exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: '모두 읽음' }).click();
  await expect(page.getByText('읽지 않은 알림이 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '알림함' })).not.toContainText('3');
  expect(calls).toEqual([]);
});

test('통합 할 일 화면은 현재 담당 미완료 작업과 기존 작업 상세 경로를 제공한다', async ({ page }) => {
  const calls = await enterPreview(page);
  await page.getByRole('button', { name: '할 일' }).click();
  await expect(page).toHaveURL(/\/preview\/my\/tasks$/);
  await expect(page.getByRole('heading', { name: '할 일', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3);
  await expect(page.getByText('완료', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '설문 결과 분석 상세 보기' }).click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/102$/);
  expect(calls).toEqual([]);
});

test('모바일에서도 헤더 액션과 할 일 표를 가로 스크롤로 사용할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page);
  await expect(page.getByRole('button', { name: '알림함' })).toBeVisible();
  await expect(page.getByRole('button', { name: '할 일' })).toBeVisible();
  await page.getByRole('button', { name: '할 일' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(await page.locator('.table-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy();
});
