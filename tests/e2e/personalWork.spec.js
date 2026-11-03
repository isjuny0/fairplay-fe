import { expect, test } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

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
  await expect(page.getByRole('region', { name: '최근 알림' })).toContainText('읽지 않은 알림 3개');
  await expect(page.getByRole('region', { name: '최근 알림' }).locator('.header-notification-preview-more')).toHaveCount(0);
  await expect(page.getByText('더 이상 접근할 수 없는 항목입니다')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /최종 평가가 시작되었습니다/ })).toBeVisible();
  await page.getByRole('button', { name: /새 작업에 배정되었습니다/ }).click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/102$/);
  expect(calls).toEqual([]);
});

test('알림함은 전체·미읽음 커서 목록과 전체 읽음을 제공한다', async ({ page }) => {
  const calls = await enterPreview(page);
  await page.goto('/preview/notifications');
  await expect(page.getByRole('heading', { name: '알림함', exact: true })).toBeVisible();
  await expect(page.getByText('더 이상 접근할 수 없는 항목입니다')).toBeVisible();
  await expect(page.locator('.personal-notification-open')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '열기' })).toHaveCount(0);
  await page.getByRole('button', { name: '읽지 않음' }).click();
  await expect(page.locator('.notification-mark-read')).toHaveCount(3);
  await page.locator('.notification-mark-read').first().click();
  await expect(page.locator('.notification-mark-read')).toHaveCount(2);
  await page.getByRole('button', { name: '모두 읽음' }).click();
  await expect(page.getByText('읽지 않은 알림이 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '알림함' })).not.toContainText('3');
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: '새 작업에 배정되었습니다 상세 보기' }).click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/102$/);
  expect(calls).toEqual([]);
});

test('통합 할 일 팝오버는 전체 작업·미제출 평가를 스크롤로 제공하고 상세로 연결한다', async ({ page }) => {
  const context = previewContext();
  const state = structuredClone(getMockState(context));
  const baseTask = state.teams[1].tasks.find((task) =>
    task.assignees?.some((assignee) => assignee.userId === context.user.id),
  );
  state.teams[1].tasks.push(...Array.from({ length: 22 }, (_, index) => ({
    ...structuredClone(baseTask),
    id: 5000 + index,
    title: `추가 작업 ${index + 1}`,
    status: 'TODO',
    startAt: '2026-12-20T09:00:00',
    dueAt: '2026-12-31T12:00:00',
  })));
  await page.addInitScript((mockState) => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v9:preview:1', JSON.stringify(mockState));
  }, state);
  const calls = await enterPreview(page);
  await page.getByRole('button', { name: '할 일' }).click();
  const popover = page.getByRole('region', { name: '할 일 미리보기' });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('할 일·평가 30개');
  await expect(popover).toContainText('최종 동료 평가');
  const list = popover.locator('.header-task-preview-cards');
  const cards = list.locator('.header-task-preview-card');
  await expect(cards).toHaveCount(30);
  const { listTop, listBottom, fifthTop, scrollHeight, clientHeight } = await list.evaluate((element) => ({
    listTop: element.getBoundingClientRect().top,
    listBottom: element.getBoundingClientRect().bottom,
    fifthTop: element.children[4].getBoundingClientRect().top,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(fifthTop).toBeGreaterThanOrEqual(listBottom);
  expect(scrollHeight).toBeGreaterThan(clientHeight);
  expect(listTop).toBeGreaterThan(0);
  await cards.last().scrollIntoViewIfNeeded();
  await cards.last().click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/5021$/);

  await page.goto('/preview/main');
  await page.getByRole('button', { name: '할 일' }).click();
  await page.getByRole('region', { name: '할 일 미리보기' }).getByRole('button', { name: /최종 동료 평가/ }).click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/peer-evaluations\?roundId=12$/);

  await page.goto('/preview/my/tasks');
  await expect(page.getByRole('heading', { name: '화면을 찾을 수 없습니다.' })).toBeVisible();
  expect(calls).toEqual([]);
});

test('모바일에서도 헤더 할 일 카드 패널이 화면 너비를 넘지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page);
  await expect(page.getByRole('button', { name: '알림함' })).toBeVisible();
  await expect(page.getByRole('button', { name: '할 일' })).toBeVisible();
  await page.getByRole('button', { name: '할 일' }).click();
  await expect(page.getByRole('region', { name: '할 일 미리보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /설문 결과 분석/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
