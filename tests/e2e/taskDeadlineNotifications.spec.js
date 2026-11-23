import { expect, test } from '@playwright/test';
import { previewMembers, previewSpace, previewTeams, previewUsers } from '../../src/mock/fixtures.js';

// NotificationType.java / docs/api.md: the existing TASK target and read API are reused.
const stages = [
  ['TASK_DEADLINE_IN_THREE_DAYS', '담당 작업의 마감이 3일 남았습니다', '마감 3일 전'],
  ['TASK_DEADLINE_TOMORROW', '담당 작업의 마감이 내일입니다', '마감 전날'],
  ['TASK_DUE_TODAY', '담당 작업의 마감이 오늘입니다', '오늘 마감'],
];
const reminders = stages.map(([type, title], index) => ({
  id: 303 - index, type, title, message: `마감 안내 작업 ${index + 1}`,
  spaceId: 1, teamId: 1, target: { type: 'TASK', id: 101 + index, taskId: null },
  accessible: true, createdAt: `2026-11-23T00:00:0${index}`, readAt: null,
}));

async function deadlineBackend(page, initial = reminders) {
  let items = structuredClone(initial);
  let unavailable = false;
  const requests = [];
  const space = { ...previewSpace, myRole: 'USER' };
  const team = { ...previewTeams[0], myMembershipStatus: 'APPROVED' };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const method = request.method();
    requests.push({ path, method, query: url.search, body: request.postData(), headers: request.headers() });
    if (unavailable && path.startsWith('/api/me/notifications'))
      return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '알림 조회 실패' } });
    if (path === '/api/me/notifications') {
      const filtered = items.filter(item =>
        (url.searchParams.get('filter') !== 'UNREAD' || !item.readAt) &&
        (url.searchParams.get('accessibleOnly') !== 'true' || item.accessible));
      return route.fulfill({ json: { items: filtered, nextCursor: null } });
    }
    if (path === '/api/me/notifications/unread-count')
      return route.fulfill({ json: { unreadCount: items.filter(item => !item.readAt && item.accessible).length } });
    if (path === '/api/me/notifications/read-all' && method === 'POST') {
      items.forEach(item => { item.readAt ||= '2026-11-23T10:00:00'; });
      return route.fulfill({ status: 204 });
    }
    const read = path.match(/^\/api\/me\/notifications\/(\d+)\/read$/);
    if (read && method === 'PATCH') {
      items.find(item => item.id === Number(read[1])).readAt ||= '2026-11-23T10:00:00';
      return route.fulfill({ status: 204 });
    }
    const taskId = path.match(/^\/api\/tasks\/(\d+)$/);
    if (taskId) {
      const item = reminders.find(item => item.target.id === Number(taskId[1]));
      return route.fulfill({ json: {
        task: { id: item.target.id, teamId: 1, title: item.message, description: '마감 알림에서 확인한 작업',
          status: 'TODO', version: 0, estimatedMinutes: 30,
          startAt: '2026-11-20T00:00:00', dueAt: '2026-11-26T00:00:00', completedAt: null,
          assignees: [{ userId: previewUsers.leader.id, allocationPercent: 100 }], completionBlockReason: 'INVALID_TASK_STATE' },
        contributions: [], deliverableSummary: [],
      } });
    }
    const responses = {
      '/api/me': previewUsers.leader,
      '/api/auth/csrf': { headerName: 'X-CSRF-TOKEN', token: 'deadline-token' },
      '/api/spaces': [space], '/api/spaces/1': space,
      '/api/spaces/1/teams': [team], '/api/teams/1': team,
      '/api/teams/1/members': previewMembers, '/api/spaces/1/evaluation-rounds': [],
      '/api/me/todos': { items: [], totalCount: 0 },
    };
    if (path in responses) return route.fulfill({ json: responses[path] });
    if (path.endsWith('/deletion-request')) return route.fulfill({ status: 404, json: { code: 'TEAM_DELETION_REQUEST_NOT_FOUND' } });
    if (path.endsWith('/deliverables') || path.endsWith('/comments')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  return { requests, replace: next => { items = structuredClone(next); }, fail: () => { unavailable = true; } };
}

for (const width of [390, 1440]) {
  for (const entry of ['알림함', '헤더']) {
    test(`${width}px ${entry}의 마감 알림 3종은 작업으로 이동하고 기존 CSRF·204 읽음을 사용한다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const backend = await deadlineBackend(page);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [index, item] of reminders.entries()) {
        await page.goto(entry === '알림함' ? '/notifications' : '/main');
        if (entry === '알림함') {
          const row = page.locator('.personal-notification').filter({ hasText: item.title });
          await expect(row.locator('.notification-type-label')).toHaveText(stages[index][2]);
          await expect(row).not.toContainText(item.type);
          await row.getByRole('button', { name: `${item.title} 상세 보기`, exact: true }).click();
        } else {
          await page.getByRole('button', { name: '알림함', exact: true }).click();
          await page.getByRole('region', { name: '최근 알림' }).getByRole('button', { name: new RegExp(item.title) }).click();
        }
        await expect(page).toHaveURL(new RegExp(`/spaces/1/teams/1/tasks/${item.target.id}$`));
        await expect(page.getByRole('heading', { name: item.message, exact: true })).toBeVisible();
        await expect.poll(() => backend.requests.filter(request => request.method === 'PATCH').length).toBe(index + 1);
      }
      const writes = backend.requests.filter(request => !['GET', 'HEAD'].includes(request.method));
      expect(writes.map(({ path, method, body, headers }) => ({ path, method, body, csrf: headers['x-csrf-token'] })))
        .toEqual(reminders.map(item => ({ path: `/api/me/notifications/${item.id}/read`, method: 'PATCH', body: null, csrf: 'deadline-token' })));
      expect(errors).toEqual([]);
    });
  }
}

test('화면을 유지하는 동안 생성된 마감 알림은 알림창 재열기와 복귀 시 새로 조회한다', async ({ page }) => {
  const backend = await deadlineBackend(page, []);
  await page.goto('/main');
  const bell = page.getByRole('button', { name: '알림함', exact: true });
  await bell.click();
  const popover = page.getByRole('region', { name: '최근 알림' });
  await expect(popover).toContainText('최근 알림이 없습니다.');
  await bell.click();
  backend.replace(reminders.slice(0, 1));
  await bell.click();
  await expect(popover).toContainText(reminders[0].title);
  await expect(bell).toContainText('1');
  backend.replace(reminders);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(popover.locator('.header-notification-preview-card')).toHaveCount(3);
  await expect(bell).toContainText('3');
  expect(backend.requests.every(request => request.method === 'GET')).toBe(true);
  backend.fail();
  await bell.click();
  await bell.click();
  await expect(popover).toContainText('알림을 불러오지 못했습니다.');
  await expect(popover).not.toContainText('최근 알림이 없습니다.');
});

test('작업 마감 알림 모두 읽음은 기존 API로 처리하고 알림창·미읽음 수를 함께 갱신한다', async ({ page }) => {
  const backend = await deadlineBackend(page);
  await page.goto('/notifications');
  const cards = page.locator('.personal-notification');
  await cards.first().getByRole('button', { name: /읽음으로 표시/ }).click();
  await expect(cards.first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(cards.first().locator('.notification-type-label')).not.toHaveCSS('color', 'rgb(179, 59, 57)');
  await expect(cards.nth(1)).toHaveCSS('background-color', 'rgb(255, 244, 244)');
  await page.getByRole('button', { name: '모두 읽음', exact: true }).click();
  await expect(page.locator('.notification-unread-label')).toHaveCount(0);
  await expect(page.locator('.personal-notification')).toHaveCount(3);
  for (const card of await cards.all()) await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const bell = page.getByRole('button', { name: '알림함', exact: true });
  await expect(bell.locator('.notification-count')).toHaveCount(0);
  await bell.click();
  await expect(page.getByRole('region', { name: '최근 알림' })).toContainText('최근 알림이 없습니다.');
  await bell.click();
  await page.getByRole('button', { name: '읽지 않음', exact: true }).click();
  await expect(page.getByText('읽지 않은 알림이 없습니다.', { exact: true })).toBeVisible();
  const write = backend.requests.find(request => request.method === 'POST');
  expect(write).toMatchObject({ path: '/api/me/notifications/read-all', body: null });
  expect(write.headers['x-csrf-token']).toBe('deadline-token');
});

for (const width of [390, 1440]) {
  test(`${width}px 미리보기에서 마감 알림 3종의 유형·작업 이동·읽음을 실제 API 요청 없이 확인한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const network = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) network.push(request.url()); });
    await page.goto('/preview/notifications');
    for (const [, title, label] of stages) {
      const row = page.locator('.personal-notification').filter({ hasText: title });
      await expect(row.locator('.notification-type-label')).toHaveText(label);
      await expect(row).toHaveCSS('background-color', 'rgb(255, 244, 244)');
    }
    await expect(page.locator('.personal-notification').filter({ hasText: '새 작업에 배정되었습니다' })).toHaveCSS('background-color', 'rgb(247, 251, 248)');
    await page.getByRole('button', { name: '알림함', exact: true }).click();
    const popover = page.getByRole('region', { name: '최근 알림' });
    await expect(popover.locator('.header-notification-preview-card')).toHaveCount(3);
    for (const [, title] of stages) await expect(popover).toContainText(title);
    const todayCard = popover.getByRole('button', { name: /담당 작업의 마감이 오늘입니다/ });
    await expect(todayCard).toHaveCSS('background-color', 'rgb(255, 244, 244)');
    await expect(todayCard).toHaveCSS('border-left-color', 'rgb(179, 59, 57)');
    await todayCard.hover();
    await expect(todayCard).toHaveCSS('background-color', 'rgb(255, 237, 237)');
    await popover.getByRole('button', { name: /담당 작업의 마감이 오늘입니다/ }).click();
    await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1\/tasks\/102$/);
    await expect(page.locator('.task-detail-page h1')).toContainText('팀 자료 검색 개선');
    await page.getByRole('button', { name: '알림함', exact: true }).click();
    await expect(popover).not.toContainText('담당 작업의 마감이 오늘입니다');
    expect(network).toEqual([]);
  });
}
