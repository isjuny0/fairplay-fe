import { test, expect } from '@playwright/test';
import { members, space, team, tasks, approvals } from './helpers/approvalFixtures.js';

async function fixture(page) {
  const state = { release: null, paused: false, taskError: null, approvalError: null, members };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const respond = (json, status = 200) => route.fulfill({ json, status });
    const fail = (status) => respond({ code: 'FIXTURE_ERROR', message: '조회가 지연되고 있습니다.' }, status);
    if (path === '/api/me') return respond({ id: 'member', name: members[0].name });
    if (path === '/api/spaces') return respond([space]);
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/teams') return respond([team]);
    if (path === '/api/teams/1') return respond(team);
    if (path === '/api/teams/1/members') return respond(state.members);
    if (path === '/api/teams/1/deletion-request')
      return respond({ code: 'TEAM_DELETION_REQUEST_NOT_FOUND', message: '삭제 요청이 없습니다.' }, 404);
    if (path === '/api/teams/1/tasks') {
      if (state.taskError) return fail(state.taskError);
      return respond(tasks);
    }
    if (path === '/api/teams/1/approvals') {
      if (state.paused) await new Promise((resolve) => { state.release = resolve; });
      if (state.approvalError) return fail(state.approvalError);
      return respond(approvals.filter((approval) => approval.status === url.searchParams.get('status')));
    }
    const taskId = Number(path.split('/')[3]);
    if (/^\/api\/tasks\/\d+$/.test(path))
      return respond({ task: tasks.find((task) => task.id === taskId), contributions: [] });
    if (/^\/api\/tasks\/\d+\/approvals$/.test(path))
      return respond(approvals.filter((approval) => approval.taskId === taskId));
    if (path === '/api/teams/1/deliverables') return respond([]);
    if (path.endsWith('/ai-review')) return respond({ code: 'AI_REVIEW_NOT_FOUND' }, 404);
    return respond({ code: 'UNEXPECTED_TEST_API', message: path }, 501);
  });
  return state;
}

const rows = (page) => page.getByRole('region', { name: '승인 요청 목록', exact: true }).locator('tbody tr');

test('작업명·번호 검색과 요청자·정렬을 조합하고 새로고침·상세 복귀에서 유지한다', async ({ page }) => {
  await fixture(page);
  await page.goto('/spaces/1/teams/1/approvals');
  await expect(rows(page)).toHaveCount(6);
  await expect(rows(page).first()).toContainText('발표 자료 최종 검증');
  await page.getByLabel('승인 작업 검색').fill('검증');
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator('.approval-list-summary')).toContainText('승인 대기 6건 · 검색 결과 3건');
  await page.getByLabel('승인 요청자').selectOption('colleague');
  await page.getByLabel('승인 요청 정렬').selectOption('oldest');
  await expect(rows(page).first()).toContainText('설문 결과 검증');
  await page.reload();
  await expect(page.getByLabel('승인 작업 검색')).toHaveValue('검증');
  await expect(page.getByLabel('승인 요청자')).toHaveValue('colleague');
  await expect(page.getByLabel('승인 요청 정렬')).toHaveValue('oldest');
  await page.getByRole('button', { name: '설문 결과 검증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설문 결과 검증', level: 1 })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('승인 작업 검색')).toHaveValue('검증');
  await expect(page.getByLabel('승인 요청자')).toHaveValue('colleague');
  await expect(rows(page).first()).toContainText('설문 결과 검증');
  await page.getByLabel('승인 작업 검색').fill('#13');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('API 오류 응답 검증');
  await page.getByLabel('승인 작업 검색').fill('api');
  await expect(rows(page)).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '설문 결과 검증', level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel('승인 작업 검색')).toHaveValue('api');
});

test('결과 없음은 빈 상태와 구분하고 초기화는 요청 상태와 무관한 주소 값을 보존한다', async ({ page }) => {
  await fixture(page);
  await page.goto('/spaces/1/teams/1/approvals?status=REJECTED&keep=1');
  await expect(rows(page)).toHaveCount(3);
  await page.getByLabel('승인 작업 검색').fill('없는 작업');
  await page.getByLabel('승인 요청자').selectOption('colleague');
  await page.getByLabel('승인 요청 정렬').selectOption('oldest');
  await expect(page.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toBeVisible();
  await page.getByRole('button', { name: '검색 조건 초기화' }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByLabel('요청 상태')).toHaveValue('REJECTED');
  await expect(page.getByLabel('승인 요청자')).toHaveValue('');
  await expect(page.getByLabel('승인 요청 정렬')).toHaveValue('newest');
  expect(new URL(page.url()).searchParams.get('keep')).toBe('1');
  await rows(page).first().getByText('반려 사유', { exact: true }).click();
  await expect(rows(page).first()).toContainText('예외 상황의 검증 근거');
  await page.getByLabel('요청 상태').selectOption('APPROVED');
  await expect(rows(page)).toHaveCount(3);
  await page.getByLabel('승인 요청자').selectOption('member');
  await expect(page.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toBeVisible();
});

test('승인 검색 조건을 하나씩 해제하고 요청 상태·다른 조건을 유지하며 입력으로 복귀한다', async ({ page }) => {
  await fixture(page);
  await page.goto('/spaces/1/teams/1/approvals?status=REJECTED&q=검증&requester=colleague&sort=oldest&keep=1');
  const filters = page.getByRole('group', { name: '적용 중인 승인 검색 조건' });
  await expect(filters.getByRole('button')).toHaveCount(3);
  await filters.getByRole('button', { name: '검색: 검증 해제', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('승인 작업 검색')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('requester')).toBe('colleague');
  expect(new URL(page.url()).searchParams.get('sort')).toBe('oldest');
  const requester = members.find(member => member.userId === 'colleague');
  await filters.getByRole('button', { name: `요청자: ${requester.name} 해제`, exact: true }).click();
  await expect(page.getByLabel('승인 요청자')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('sort')).toBe('oldest');
  await page.reload();
  await expect(filters.getByRole('button')).toHaveCount(1);
  await filters.getByRole('button', { name: '정렬: 오래된 요청 순 해제', exact: true }).click();
  await expect(page.getByLabel('승인 요청 정렬')).toBeFocused();
  await expect(filters).toHaveCount(0);
  await expect(page.getByLabel('요청 상태')).toHaveValue('REJECTED');
  expect(new URL(page.url()).searchParams.get('keep')).toBe('1');
  await page.getByLabel('승인 작업 검색').fill('검증');
  await page.getByRole('button', { name: '검색 조건 초기화', exact: true }).click();
  await expect(page.getByLabel('승인 작업 검색')).toBeFocused();
  await expect(page.getByLabel('요청 상태')).toHaveValue('REJECTED');
});

test('상태 조회 중에는 이전 요청과 검색 건수를 숨기고 실패는 재조회로 복구한다', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/spaces/1/teams/1/approvals?q=검증');
  await expect(rows(page)).toHaveCount(3);
  state.paused = true;
  await page.getByLabel('요청 상태').selectOption('REJECTED');
  await expect(page.getByRole('status', { name: '승인 요청 목록 불러오는 중' })).toBeVisible();
  await expect(page.locator('.approval-list-summary')).toHaveCount(0);
  await expect(page.getByText('설문 결과 검증', { exact: true })).toHaveCount(0);
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.approvalError = 503;
  state.paused = false;
  state.release();
  await expect(page.getByRole('alert')).toContainText('조회가 지연되고 있습니다.');
  await expect(page.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toHaveCount(0);
  state.approvalError = null;
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByLabel('승인 작업 검색')).toHaveValue('검증');
});

test('작업명 조회 실패를 검색 결과 없음으로 바꾸지 않고 권한 오류를 안내한다', async ({ page }) => {
  const state = await fixture(page);
  state.taskError = 403;
  await page.goto('/spaces/1/teams/1/approvals?q=검증');
  await expect(page.getByRole('alert')).toContainText('참여 상태');
  await expect(page.locator('.approval-list-summary')).toHaveCount(0);
  await expect(page.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '내 스페이스로 이동' })).toBeVisible();
});

test('긴 검색어·요청자 이름과 정렬 제어는 웹과 좁은 화면에서 넘치지 않는다', async ({ page }) => {
  const state = await fixture(page);
  state.members = members.map((member) => ({ ...member, name: member.name.repeat(12) }));
  for (const width of [1440, 1280, 1024, 320]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/spaces/1/teams/1/approvals?q='+ 'LongSearchTerm'.repeat(6) + '&requester=unknown');
    await expect(page.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '검색 조건 초기화' }).click();
    await expect(rows(page)).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const inputHeight = await page.getByLabel('승인 작업 검색').evaluate((element) => element.getBoundingClientRect().height);
    const selectHeight = await page.getByLabel('요청 상태').evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(inputHeight - selectHeight)).toBeLessThanOrEqual(4);
  }
});
