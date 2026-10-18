import { test, expect } from '@playwright/test';

function scriptRequests(page) {
  const scripts = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  return scripts;
}

test('소개·실제 로그인은 미리보기와 업무 화면 코드를 요청하지 않는다', async ({ page }) => {
  const scripts = scriptRequests(page);
  const apiCalls = [];
  await page.route('**/api/**', route => {
    apiCalls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } });
  });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  expect(apiCalls).toEqual([]);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Google로 계속하기', exact: true })).toBeVisible();
  expect(apiCalls).toEqual(['/api/me']);
  expect(scripts.some(path => /(?:PreviewApplication|preview-|TaskBoard|ManagerDashboard|PeerEvaluation|MarkdownContent)-?/.test(path))).toBe(false);
});

test('운영 빌드도 현재 작업 화면만 불러오고 탭·주소·필터를 유지한다', async ({ page }) => {
  const scripts = scriptRequests(page);
  const apiCalls = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url()); });
  await page.goto('/preview/spaces/1/teams/1/tasks?view=list&q=설문');
  await expect(page.getByRole('button', { name: '설문 결과 분석', exact: true })).toBeVisible();
  expect(scripts.some(path => path.includes('TaskBoard-'))).toBe(true);
  expect(scripts.some(path => path.includes('preview-'))).toBe(true);
  expect(scripts.some(path => /ManagerDashboard-|PeerEvaluation-|MarkdownContent-|TaskDetail-/.test(path))).toBe(false);
  await page.getByRole('button', { name: '설문 결과 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설문 결과 분석', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await page.reload();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await page.getByRole('button', { name: '동료 평가', exact: true }).click();
  await expect(page.getByRole('heading', { name: '동료 평가', exact: true })).toBeVisible();
  expect(scripts.some(path => path.includes('PeerEvaluation-'))).toBe(true);
  expect(apiCalls).toEqual([]);
});

test('화면 청크 로딩 실패는 오류를 안내하고 새로고침으로 복구한다', async ({ page }) => {
  let failed = true;
  await page.route('**/assets/TaskBoard-*.js', route => failed ? route.abort() : route.continue());
  await page.goto('/preview/spaces/1/teams/1/tasks?view=list');
  await expect(page.getByRole('heading', { name: '화면을 불러오지 못했습니다.', exact: true })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '작업', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('view')).toBe('list');
});
