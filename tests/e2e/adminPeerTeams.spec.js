import { test, expect } from '@playwright/test';

async function manyTeams(page, { count = 37, manager = true } = {}) {
  const space = { id: 1, name: '디자인 프로젝트', myRole: manager ? 'MANAGER' : 'USER', teamBuildingStatus: 'CLOSED', teamBuildingOpensAt: '2026-01-01T09:00:00', teamBuildingClosesAt: '2026-01-02T09:00:00', version: 1 };
  const teams = Array.from({ length: count }, (_, index) => ({ id: index + 1, spaceId: 1, name: `디자인 ${index + 1}팀`, approvedMemberCount: 4, myMembershipStatus: null }));
  const rounds = ['MID', 'FINAL'].map((type, index) => ({ id: 11 + index, type, spaceId: 1, status: index === 0 ? 'CLOSED' : 'OPEN', opensAt: '2026-01-03T09:00:00', closesAt: '2030-12-01T18:00:00', version: 1 }));
  const rows = teams.map((team, index) => ({ teamId: team.id, requiredCount: index === 36 ? 0 : 4, submittedCount: index === 36 ? 0 : index % 5, missingCount: index === 36 ? 0 : 4 - index % 5 }));
  const state = { requests: [], failDashboard: false, failResponses: false, teams, rows };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    state.requests.push({ path, method: request.method() });
    const respond = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/me') return respond({ id: 'manager', name: '관리자' });
    if (path === '/api/me/notifications/unread-count') return respond({ unreadCount: 0 });
    if (path === '/api/spaces') return respond([space]);
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/teams') return respond(teams);
    if (path === '/api/spaces/1/evaluation-rounds') return respond(rounds);
    if (path === '/api/spaces/1/manager-dashboard') return state.failDashboard
      ? respond({ code: 'FORBIDDEN', message: '현황 조회 권한이 없습니다.' }, 403)
      : respond({ spaceId: 1, totalTeamCount: teams.length, teams: [], missingPeerSubmissions: rounds.map((round) => ({ roundId: round.id, type: round.type, status: round.status, teams: rows })) });
    const match = path.match(/^\/api\/evaluation-rounds\/(\d+)\/teams\/(\d+)\/responses$/);
    if (match) {
      if (state.failResponses) return respond({ code: 'FORBIDDEN', message: '평가 조회 권한이 없습니다.' }, 403);
      const teamId = Number(match[2]);
      return respond({ roundId: Number(match[1]), teamId, requiredCount: 4, submittedCount: 4, missingCount: 0, responses: [{ evaluatorId: `evaluator-${teamId}`, evaluatorName: `작성자 ${teamId}`, targetId: `target-${teamId}`, targetName: `팀원 ${teamId}`, scores: { taskExecution: 4, responsibility: 4, collaboration: 4, communication: 4 }, reason: '최종 제출된 평가 사유', submittedAt: '2026-10-15T19:00:00' }] });
    }
    return respond([]);
  });
  return state;
}

for (const width of [1440, 390, 320]) {
  test(`${width}px 다수 팀은 요약·검색·필터·정렬·페이지로 관리하고 조건을 복원한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await manyTeams(page);
    await page.goto('/spaces/1/rounds');
    const mid = page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true });
    const final = page.getByRole('region', { name: '최종 평가 팀별 제출 현황', exact: true });
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(10);
    await expect(final.locator('.round-team-submissions > li')).toHaveCount(10);
    const summary = mid.getByRole('definition');
    await expect(summary).toHaveText(['37팀', '7팀', '29팀', '74명']);
    await expect(mid.locator('.round-team-submissions > li > strong').first()).toHaveText('디자인 1팀');
    const pagination = mid.getByRole('navigation', { name: '중간 평가 팀 목록 페이지', exact: true });
    await expect(pagination).toContainText('1 / 4페이지');
    await expect(pagination.getByRole('button', { name: '이전', exact: true })).toBeDisabled();
    await pagination.getByRole('button', { name: '다음', exact: true }).click();
    await expect(pagination).toContainText('2 / 4페이지');
    await expect(page).toHaveURL(/submissionMIDPage=2/);
    await page.reload();
    await expect(pagination).toContainText('2 / 4페이지');
    await mid.getByLabel('제출 상태', { exact: true }).selectOption('submitted');
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(7);
    await expect(mid.locator('.round-team-submissions')).not.toContainText('평가 대상 없음');
    await expect(summary).toHaveText(['37팀', '7팀', '29팀', '74명']);
    await expect(final.locator('.round-team-submissions > li')).toHaveCount(10);
    await mid.getByLabel('팀 이름 검색', { exact: true }).fill('디자인 10팀');
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(1);
    await expect(mid).toContainText('디자인 10팀');
    await page.getByRole('button', { name: '회차·제출 현황 새로고침', exact: true }).click();
    await expect(mid.getByLabel('팀 이름 검색', { exact: true })).toHaveValue('디자인 10팀');
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(1);
    await mid.getByLabel('팀 이름 검색', { exact: true }).fill('없는 팀');
    await expect(mid.getByText('조건에 맞는 팀이 없습니다.', { exact: true })).toBeVisible();
    await mid.getByRole('button', { name: '검색·필터 초기화', exact: true }).click();
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(10);
    await mid.getByLabel('팀 정렬', { exact: true }).selectOption('name');
    await expect(mid.locator('.round-team-submissions > li > strong')).toHaveText(Array.from({ length: 10 }, (_, i) => `디자인 ${i + 1}팀`));
    await expect(mid.getByRole('button', { name: '디자인 1팀 중간 평가 결과 보기', exact: true })).toBeVisible();
    await expect(final.getByRole('button', { name: /결과 보기/ })).toHaveCount(0);
    if (width > 720) {
      const sidebar = await page.locator('.workspace-sidebar').boundingBox();
      const heading = await page.getByRole('heading', { name: '동료 평가 관리', exact: true }).boundingBox();
      expect(heading.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
    }
    await page.screenshot({ path: testInfo.outputPath('admin-peer-teams.png'), fullPage: true, animations: 'disabled' });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('admin-peer-viewport.png'), animations: 'disabled' });
    expect(await mid.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(state.requests.every((request) => request.method === 'GET')).toBe(true);
  });

  test(`${width}px 팀 결과 바로가기와 팀 검색은 선택·회차·뒤로가기를 유지한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await manyTeams(page);
    await page.goto('/spaces/1/rounds?submissionMIDSearch=디자인+6팀');
    await page.getByRole('button', { name: '디자인 6팀 중간 평가 결과 보기', exact: true }).click();
    await expect(page).toHaveURL(/tab=peer-responses/);
    await expect(page).toHaveURL(/peerTeamId=6/);
    await expect(page).toHaveURL(/peerRoundId=11/);
    const panel = page.getByRole('region', { name: '관리자 동료 평가 상세', exact: true });
    await expect(panel.getByRole('heading', { name: '팀원 6님이 받은 평가', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true }).getByLabel('팀 이름 검색', { exact: true })).toHaveValue('디자인 6팀');
    await page.getByRole('button', { name: '디자인 6팀 중간 평가 결과 보기', exact: true }).click();
    await expect(panel.getByRole('heading', { name: '팀원 6님이 받은 평가', exact: true })).toBeVisible();
    await panel.getByLabel('결과 조회 팀 검색', { exact: true }).fill('디자인 27팀');
    await expect(panel.getByLabel('평가 결과 대상 팀', { exact: true }).getByRole('option')).toHaveText(['디자인 6팀', '디자인 27팀']);
    await panel.getByLabel('평가 결과 대상 팀', { exact: true }).selectOption('27');
    await expect(panel.getByRole('heading', { name: '팀원 27님이 받은 평가', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('admin-peer-results.png'), animations: 'disabled' });
    await panel.getByLabel('결과 조회 팀 검색', { exact: true }).fill('없는 팀');
    await expect(panel.getByRole('status')).toContainText('검색 결과 0팀');
    await expect(panel.getByRole('heading', { name: '팀원 27님이 받은 평가', exact: true })).toBeVisible();
    await page.reload();
    await expect(panel.getByLabel('평가 결과 대상 팀', { exact: true })).toHaveValue('27');
    await expect(panel.getByLabel('결과 조회 팀 검색', { exact: true })).toHaveValue('없는 팀');
    await panel.getByLabel('결과 조회 회차', { exact: true }).selectOption('12');
    await expect(panel).toContainText('회차 마감 후 최종 제출된 평가를 조회할 수 있습니다.');
    expect(state.requests.some((request) => request.path === '/api/evaluation-rounds/12/teams/27/responses')).toBe(false);
    await page.getByRole('tab', { name: '평가 일정·진행 현황', exact: true }).click();
    const mid = page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true });
    await expect(mid.getByLabel('팀 이름 검색', { exact: true })).toHaveValue('디자인 6팀');
    await expect(mid.locator('.round-team-submissions > li')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('현황 권한 오류 후 이전 목록을 숨기고 재조회 시 필터를 복원한다', async ({ page }) => {
  const state = await manyTeams(page);
  await page.goto('/spaces/1/rounds?submissionMIDStatus=missing');
  await expect(page.locator('.round-team-submissions')).toHaveCount(2);
  state.failDashboard = true;
  await page.getByRole('button', { name: '회차·제출 현황 새로고침', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('현황 조회 권한이 없습니다.');
  await expect(page.locator('.round-team-submissions')).toHaveCount(0);
  state.failDashboard = false;
  await page.getByRole('button', { name: '회차·제출 현황 새로고침', exact: true }).click();
  await expect(page.locator('.round-team-submissions')).toHaveCount(2);
  await expect(page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true }).getByLabel('제출 상태', { exact: true })).toHaveValue('missing');
});

test('참여 팀이 없으면 현황과 결과에 빈 상태를 표시한다', async ({ page }) => {
  await manyTeams(page, { count: 0 });
  await page.goto('/spaces/1/rounds?submissionMIDPage=999');
  await expect(page.getByText('참여 팀이 없습니다.', { exact: true })).toHaveCount(2);
  await expect(page.locator('.round-team-submissions')).toHaveCount(0);
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
  await expect(page.getByText('조회할 팀과 평가 회차가 필요합니다.', { exact: true })).toBeVisible();
});

test('초과 페이지는 마지막으로 보정하고 새로고침으로 팀 수가 줄어도 빈 페이지에 머물지 않는다', async ({ page }) => {
  const state = await manyTeams(page);
  await page.goto('/spaces/1/rounds?submissionMIDPage=999&submissionMIDSort=name');
  const mid = page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true });
  await expect(mid.locator('.round-team-submissions > li')).toHaveCount(7);
  await expect(mid.getByRole('navigation')).toContainText('4 / 4페이지');
  state.rows.splice(3);
  await page.getByRole('button', { name: '회차·제출 현황 새로고침', exact: true }).click();
  await expect(mid.locator('.round-team-submissions > li')).toHaveCount(3);
  await expect(mid.getByRole('navigation')).toHaveCount(0);
});

test('잘못된 결과 팀 ID는 다른 팀으로 몰래 전환하거나 응답을 요청하지 않는다', async ({ page }) => {
  const state = await manyTeams(page);
  await page.goto('/spaces/1/rounds?tab=peer-responses&peerTeamId=9999');
  await expect(page.getByText('조회할 팀과 평가 회차가 필요합니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('평가 결과 대상 팀', { exact: true })).toHaveValue('');
  expect(state.requests.some((request) => request.path.endsWith('/responses'))).toBe(false);
  await page.getByLabel('평가 결과 대상 팀', { exact: true }).selectOption('2');
  await expect(page.getByRole('heading', { name: '팀원 2님이 받은 평가', exact: true })).toBeVisible();
});

test('평가 결과 새로고침의 권한 오류는 이전 원문을 숨긴다', async ({ page }) => {
  const state = await manyTeams(page);
  await page.goto('/spaces/1/rounds?tab=peer-responses&peerTeamId=2');
  await expect(page.getByRole('heading', { name: '팀원 2님이 받은 평가', exact: true })).toBeVisible();
  state.failResponses = true;
  await page.getByRole('button', { name: '평가 결과 새로고침', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('평가 조회 권한이 없습니다.');
  await expect(page.getByRole('heading', { name: '팀원 2님이 받은 평가', exact: true })).toHaveCount(0);
});

test('일반 참여자는 관리자 평가 관리에 접근할 수 없다', async ({ page }) => {
  const state = await manyTeams(page, { manager: false });
  await page.goto('/spaces/1/rounds');
  await expect(page.getByRole('heading', { name: '스페이스 관리 권한이 없습니다.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '동료 평가 관리', exact: true })).toHaveCount(0);
  expect(state.requests.some((request) => request.path.includes('manager-dashboard') || request.path.includes('evaluation-rounds'))).toBe(false);
});

test('1,000개 팀도 회차별 10행만 렌더링하고 이름 검색으로 바로 찾는다', async ({ page }) => {
  await manyTeams(page, { count: 1000 });
  await page.goto('/spaces/1/rounds?submissionMIDPage=100&submissionMIDSort=name');
  const mid = page.getByRole('region', { name: '중간 평가 팀별 제출 현황', exact: true });
  await expect(mid.locator('.round-team-submissions > li')).toHaveCount(10);
  await expect(mid.getByRole('navigation')).toContainText('100 / 100페이지');
  await mid.getByLabel('팀 이름 검색', { exact: true }).fill('디자인 1000팀');
  await expect(mid.locator('.round-team-submissions > li')).toHaveCount(1);
  await expect(mid.locator('li > strong')).toHaveText('디자인 1000팀');
});
