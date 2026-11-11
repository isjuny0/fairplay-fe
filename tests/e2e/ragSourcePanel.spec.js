import { test, expect } from '@playwright/test';

async function materials(page, { endLine = 2, status = 200 } = {}) {
  const team = { id: 1, spaceId: 1, name: '검색 팀', leaderId: 'user', myMembershipStatus: 'APPROVED', approvedMemberCount: 2 };
  const space = { id: 1, name: '검색 스페이스', myRole: 'MEMBER' };
  const reference = { sourceId: 'source-1', teamId: 1, deliverableId: 10, deliverableVersion: 1,
    title: '프로젝트 소개', type: 'TEXT', startLine: 1, endLine, headingPath: [], quote: '프로젝트 목표' };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const respond = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/me') return respond({ id: 'user', name: '사용자' });
    if (path === '/api/auth/csrf') return respond({ headerName: 'X-CSRF-TOKEN', token: 'test' });
    if (path === '/api/spaces') return respond([space]);
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/teams') return respond([team]);
    if (path === '/api/teams/1') return respond(team);
    if (path === '/api/teams/1/members') return respond([{ userId: 'user', name: '사용자', role: 'LEADER' }]);
    if (path.endsWith('/deletion-request')) return respond({ code: 'NOT_FOUND' }, 404);
    if (path.endsWith('/rag/index-status')) return respond({ enabled: true, readyCount: 1, pendingCount: 0, totalElements: 1, totalPages: 1, items: [] });
    if (path.endsWith('/rag/questions')) return respond({ teamId: 1, answerable: true,
      answer: '프로젝트 목표를 확인했습니다.', limitations: [], references: [reference] });
    if (path.endsWith('/rag/sources/10')) return status === 200
      ? respond({ ...reference, content: '프로젝트 목표\n프로젝트 범위' })
      : respond({ code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: '원문 접근 권한이 없습니다.' }, status);
    return respond([]);
  });
  await page.goto('/spaces/1/teams/1/materials-search');
  await page.getByLabel('팀 자료에서 어떤 내용을 찾고 있나요?').fill('프로젝트 목표는?');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  return page.getByRole('button', { name: '프로젝트 소개 원문 확인', exact: true });
}

test('원문을 닫으면 근거 버튼으로 포커스를 복원한다', async ({ page }) => {
  const citation = await materials(page);
  await citation.click();
  const panel = page.getByRole('region', { name: '근거 원문', exact: true });
  await expect(panel).toBeFocused();
  await expect(panel.locator('[data-source-highlight="true"]')).toHaveCount(2);
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(citation).toBeFocused();
});

test('본문 범위를 벗어난 인용은 일부 줄을 근거처럼 강조하지 않는다', async ({ page }) => {
  const citation = await materials(page, { endLine: 10 });
  await citation.click();
  const panel = page.getByRole('region', { name: '근거 원문', exact: true });
  await expect(panel.getByRole('region', { name: '줄 번호가 있는 원문' })).toContainText('프로젝트 범위');
  await expect(panel.locator('[data-source-highlight="true"]')).toHaveCount(0);
});

for (const status of [401, 403]) {
  test(`원문 ${status} 오류 후 기존 답변과 원문을 남기지 않는다`, async ({ page }) => {
    const citation = await materials(page, { status });
    await citation.click();
    await expect(page.getByRole('region', { name: '근거 원문', exact: true })).toHaveCount(0);
    await expect(page.getByRole('article', { name: '자료 검색 답변' })).toHaveCount(0);
    await expect(page.getByText(status === 401 ? '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' : '팀 참여 상태와 접근 권한을 확인해 주세요.', { exact: false })).toBeVisible();
  });
}
