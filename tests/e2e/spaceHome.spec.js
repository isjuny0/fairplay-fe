import { test, expect } from '@playwright/test';

async function spaceHome(page, { joined = true, empty = false, rejected = false } = {}) {
  const space = {
    id: 1, name: '캡스톤 프로젝트', description: '함께 만드는 서비스',
    myRole: 'USER', teamBuildingStatus: 'OPEN',
    startAt: '2026-01-01T00:00:00',
    endAt: '2030-12-31T23:59:00',
    teamBuildingOpensAt: '2026-01-01T00:00:00',
    teamBuildingClosesAt: '2030-01-01T00:00:00',
  };
  const teams = empty ? [] : [
    {
      id: 1, spaceId: 1, name: '삼위일체', leaderId: 'me',
      myMembershipStatus: joined ? 'APPROVED' : null,
      approvedMemberCount: 3, canApply: !joined,
    },
    {
      id: 2, spaceId: 1, name: '파도', leaderId: 'other',
      myMembershipStatus: rejected ? 'REJECTED' : null,
      approvedMemberCount: 2, canApply: !joined,
    },
  ];
  const writes = [];
  const memberReads = [];
  const members = {
    1: [
      { userId: 'me', name: '박선우', role: 'LEADER' },
      { userId: 'member-1', name: '이지원', role: 'MEMBER' },
      { userId: 'member-2', name: '박서연', role: 'MEMBER' },
    ],
    2: [
      { userId: 'other', name: '강민지', role: 'LEADER' },
      { userId: 'other-member', name: '윤서준', role: 'MEMBER' },
    ],
  };
  let memberFailure = null;
  let cancelFailure = null;
  let failDetail = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/me') return reply({ id: 'me', name: '박선우' });
    if (path === '/api/auth/csrf') return reply({ headerName: 'X-CSRF-TOKEN', token: 'test' });
    if (req.method() === 'DELETE') {
      const team = teams.find((item) => path === `/api/teams/${item.id}/applications/me`);
      if (team) {
        writes.push({ path, body: null });
        if (cancelFailure)
          return reply({ code: 'CANCEL_UNAVAILABLE', message: '가입 신청 취소 API가 준비되지 않았습니다.' }, cancelFailure);
        if (team.myMembershipStatus !== 'PENDING')
          return reply({ code: 'APPLICATION_ALREADY_DECIDED', message: '이미 처리된 신청입니다.' }, 409);
        team.myMembershipStatus = null;
        team.canApply = !joined;
        return route.fulfill({ status: 204 });
      }
    }
    if (req.method() === 'POST') {
      writes.push({ path, body: req.postDataJSON() });
      if (path === '/api/spaces/1/teams') {
        const team = { id: 3, spaceId: 1, name: req.postDataJSON().name, leaderId: 'me', myMembershipStatus: 'APPROVED', approvedMemberCount: 1 };
        teams.push(team);
        return reply(team);
      }
      const team = teams.find((item) => path === `/api/teams/${item.id}/applications`);
      if (team) {
        team.myMembershipStatus = 'PENDING';
        team.canApply = false;
        return reply({ id: 99, status: 'PENDING' });
      }
    }
    if (path === '/api/spaces') return reply([space]);
    if (path === '/api/spaces/1') return reply(space);
    // Real list responses can omit membership and leader information.
    if (path === '/api/spaces/1/teams') return reply(teams.map(({ id, name }) => ({ id, name })));
    const memberMatch = path.match(/^\/api\/teams\/(\d+)\/members$/);
    if (memberMatch) {
      memberReads.push(Number(memberMatch[1]));
      return memberFailure
        ? reply({ code: 'MEMBERS_UNAVAILABLE', message: '팀원 목록을 확인할 수 없습니다.' }, memberFailure)
        : reply(members[memberMatch[1]] || []);
    }
    const detail = teams.find((item) => path === `/api/teams/${item.id}`);
    if (detail) return failDetail
      ? reply({ code: 'READ_FAILED', message: '팀 정보를 불러오지 못했습니다.' }, 500)
      : reply(detail);
    return reply({ code: 'TEST_API_NOT_FOUND', message: path }, 404);
  });
  return {
    space, teams, writes, memberReads,
    setDetailFailure: (value) => { failDetail = value; },
    setMemberFailure: (value) => { memberFailure = value; },
    setCancelFailure: (value) => { cancelFailure = value; },
  };
}

test('팀원 수에 마우스를 올리거나 키보드로 선택하면 명단을 표시하고 카드 이동과 구분한다', async ({ page }) => {
  const fixture = await spaceHome(page);
  await page.goto('/spaces/1');
  const trigger = page.getByRole('button', { name: '삼위일체 인원 3명 보기', exact: true });
  await expect(trigger).toBeVisible();
  expect(fixture.memberReads).toEqual([]);
  await trigger.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip.locator('.space-home-member-name')).toHaveText(['박선우', '이지원', '박서연']);
  const leader = tooltip.getByRole('listitem').filter({ hasText: '박선우' }).getByRole('img', { name: '팀 리더', exact: true });
  await expect(leader).toBeVisible();
  await expect(leader).toHaveCSS('background-color', 'rgb(8, 124, 85)');
  await expect(tooltip).toHaveText('박선우이지원박서연');
  const countBounds = await trigger.boundingBox();
  const tooltipBounds = await tooltip.boundingBox();
  expect(tooltipBounds.y).toBeGreaterThanOrEqual(countBounds.y + countBounds.height);
  expect(fixture.memberReads).toEqual([1]);
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await trigger.focus();
  await expect(tooltip).toContainText('박선우');
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await trigger.click();
  await expect(tooltip).toContainText('이지원');
  await expect(trigger).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await trigger.click();
  await expect(tooltip).toContainText('이지원');
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await page.getByRole('heading', { name: '캡스톤 프로젝트', exact: true }).click();
  await expect(tooltip).toHaveCount(0);
  await page.getByRole('button', { name: '삼위일체 팀 홈으로 이동', exact: true }).click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(/\/spaces\/1\/teams\/1$/);
});

test('팀원 수를 모바일에서 누르면 다른 팀의 이름도 보이고 화면을 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const fixture = await spaceHome(page, { joined: false });
  await page.goto('/spaces/1');
  await page.getByRole('button', { name: '파도 인원 2명 보기', exact: true }).click();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('강민지');
  await expect(tooltip).toContainText('윤서준');
  const bounds = await tooltip.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await expect(page).toHaveURL(/\/spaces\/1$/);
  expect(fixture.writes).toEqual([]);
});

test('팀원 수 조회가 거부되면 이름을 추측하지 않고 다음 조회에서 다시 확인한다', async ({ page }) => {
  const fixture = await spaceHome(page);
  fixture.setMemberFailure(403);
  await page.goto('/spaces/1');
  const trigger = page.getByRole('button', { name: '삼위일체 인원 3명 보기', exact: true });
  await trigger.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('팀원 목록을 볼 권한이 없습니다.');
  await expect(tooltip.getByRole('listitem')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  fixture.setMemberFailure(null);
  await trigger.hover();
  await expect(tooltip).toContainText('박선우');
});

test('로그인한 사용자는 상세 응답의 소속으로 내 팀과 다른 팀을 구분하고 사이드바에서 내 팀으로 이동한다', async ({ page }) => {
  const fixture = await spaceHome(page);
  await page.goto('/spaces/1');
  await expect(page.locator('.space-home-eyebrow')).toHaveText('스페이스 홈');
  await expect(page.locator('.space-home-eyebrow')).toHaveCSS('color', 'rgb(8, 124, 85)');
  await expect(page.locator('.space-home-intro p')).toHaveText('소개: 함께 만드는 서비스');
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await expect(own).toContainText('삼위일체');
  await expect(own).toContainText('팀 리더');
  const others = page.getByRole('list', { name: '팀 목록', exact: true });
  await expect(others.getByRole('listitem')).toHaveCount(1);
  await expect(others).toContainText('파도');
  await expect(others.getByRole('heading', { name: '삼위일체', exact: true })).toHaveCount(0);
  const apply = others.getByRole('button', { name: '파도 가입 신청', exact: true });
  await expect(apply).toBeVisible();
  await expect(apply).toBeDisabled();
  await expect(apply).toHaveAccessibleDescription(/이미 삼위일체 팀에 소속/);
  await expect(page.getByRole('button', { name: '팀 만들기', exact: true })).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
  const sidebar = page.getByRole('navigation', { name: '스페이스 메뉴', exact: true });
  await expect(sidebar.getByRole('button', { name: '팀 목록', exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole('combobox', { name: '팀 선택', exact: true })).toHaveCount(0);
  await sidebar.getByRole('button', { name: '내 팀 · 삼위일체', exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/1\/teams\/1$/);
  const spaceHomeLink = sidebar.getByRole('button', { name: '스페이스 홈', exact: true });
  await expect(spaceHomeLink).toBeVisible();
  await expect(spaceHomeLink).not.toHaveAttribute('aria-current', 'page');
  await spaceHomeLink.click();
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await expect(spaceHomeLink).toHaveAttribute('aria-current', 'page');
});

for (const rejected of [false, true]) {
  test(`미가입 참여자는 ${rejected ? '반려 후 재신청' : '가입 신청'} 뒤 승인 대기로 표시되고 내 팀에는 포함되지 않는다`, async ({ page }) => {
    const fixture = await spaceHome(page, { joined: false, rejected });
    await page.goto('/spaces/1');
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '파도', exact: true }) });
    await card.getByRole('button', { name: `파도 ${rejected ? '다시 신청' : '가입 신청'}`, exact: true }).click();
    await expect(card).toContainText('가입 승인 대기');
    await expect(card.getByRole('button', { name: /가입 신청|다시 신청/ })).toHaveCount(0);
    await expect(card.getByRole('button', { name: '파도 신청 취소', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeDisabled();
    const own = page.getByRole('region', { name: '내 팀', exact: true });
    await expect(own.getByRole('button', { name: '팀 만들기', exact: true })).toHaveCount(0);
    await expect(own.getByRole('status')).toHaveText('팀 가입승인 대기 상태 이므로 팀을 만들 수 없습니다. 팀을 만드려면 신청 취소 해주세요');
    await own.getByRole('status').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^내 팀 ·/ })).toHaveCount(0);
    expect(fixture.writes).toEqual([{ path: '/api/teams/2/applications', body: null }]);
    await page.reload();
    const cancel = page.getByRole('button', { name: '파도 신청 취소', exact: true });
    await expect(cancel).toBeEnabled();
    await expect(own.getByRole('status')).toBeVisible();
    await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeDisabled();
    await cancel.click();
    await expect(page.getByRole('button', { name: '파도 가입 신청', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeEnabled();
    await expect(page.getByText('파도 팀 가입 신청을 취소했습니다.', { exact: true })).toBeVisible();
    await expect(own.getByRole('status')).toHaveCount(0);
    expect(fixture.writes).toEqual([
      { path: '/api/teams/2/applications', body: null },
      { path: '/api/teams/2/applications/me', body: null },
    ]);
    await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '팀 만들기' })).toBeVisible();
  });
}

test('취소 API가 아직 없으면 성공으로 표시하거나 다른 신청 버튼을 풀지 않는다', async ({ page }) => {
  const fixture = await spaceHome(page, { joined: false });
  fixture.setCancelFailure(501);
  await page.goto('/spaces/1');
  await page.getByRole('button', { name: '파도 가입 신청', exact: true }).click();
  const cancel = page.getByRole('button', { name: '파도 신청 취소', exact: true });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(page.getByRole('alert')).toContainText('가입 신청 취소 API가 준비되지 않았습니다.');
  await expect(cancel).toBeEnabled();
  await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeDisabled();
  expect(fixture.writes).toEqual([
    { path: '/api/teams/2/applications', body: null },
    { path: '/api/teams/2/applications/me', body: null },
  ]);
});

for (const action of ['apply', 'cancel']) {
  test(`${action} 요청 중 서버 소속이 바뀌면 중복 요청 없이 최신 팀을 표시한다`, async ({ page }) => {
    const fixture = await spaceHome(page, { joined: false });
    await page.goto('/spaces/1');
    if (action === 'cancel') {
      await page.getByRole('button', { name: '파도 가입 신청', exact: true }).click();
      await expect(page.getByRole('button', { name: '파도 신청 취소', exact: true })).toBeEnabled();
    }
    let attempts = 0;
    const message = '이미 팀에 가입되어 있습니다. 최신 가입 상태를 확인해 주세요.';
    await page.route(`**/api/teams/2/applications${action === 'cancel' ? '/me' : ''}`, (route) => {
      attempts++;
      fixture.teams[1].myMembershipStatus = 'APPROVED';
      fixture.teams.forEach((team) => { team.canApply = false; });
      return route.fulfill({ status: 409, json: { code: action === 'cancel' ? 'APPLICATION_ALREADY_DECIDED' : 'ALREADY_TEAM_MEMBER', message } });
    });
    await page.getByRole('button', { name: `파도 ${action === 'cancel' ? '신청 취소' : '가입 신청'}`, exact: true }).click();
    const own = page.getByRole('region', { name: '내 팀', exact: true });
    await expect(own).toContainText('파도');
    await expect(page.locator('.success-toast')).toHaveText(new RegExp(message));
    await expect(page.getByRole('button', { name: '삼위일체 가입 신청', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '파도 신청 취소', exact: true })).toHaveCount(0);
    expect(attempts).toBe(1);
  });
}

test('팀 생성 중 다른 신청이 생겨 충돌하면 생성 창을 닫고 가입 대기 상태를 표시한다', async ({ page }) => {
  const fixture = await spaceHome(page, { joined: false });
  await page.goto('/spaces/1');
  await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '팀 만들기' });
  await dialog.getByLabel('팀 이름').fill('새 팀');
  let attempts = 0;
  await page.route('**/api/spaces/1/teams', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts++;
    fixture.teams[1].myMembershipStatus = 'PENDING';
    fixture.teams.forEach((team) => { team.canApply = false; });
    return route.fulfill({ status: 409, json: { code: 'APPLICATION_CONFLICT', message: '대기 중인 가입 신청이 있습니다.' } });
  });
  await dialog.getByRole('button', { name: '팀 만들기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: '내 팀', exact: true }).getByRole('status')).toContainText('팀 가입승인 대기 상태 이므로');
  await expect(page.getByRole('button', { name: '파도 신청 취소', exact: true })).toBeEnabled();
  await expect(page.locator('.success-toast')).toContainText('대기 중인 가입 신청이 있습니다.');
  expect(attempts).toBe(1);
});

test('다른 창에서 이미 취소되어 404 APPLICATION_NOT_FOUND이면 최신 상태를 조회한다', async ({ page }) => {
  const fixture = await spaceHome(page, { joined: false });
  await page.goto('/spaces/1');
  await page.getByRole('button', { name: '파도 가입 신청', exact: true }).click();
  const cancel = page.getByRole('button', { name: '파도 신청 취소', exact: true });
  await expect(cancel).toBeEnabled();
  let attempts = 0;
  await page.route('**/api/teams/2/applications/me', (route) => {
    attempts++;
    fixture.teams[1].myMembershipStatus = null;
    fixture.teams[1].canApply = true;
    return route.fulfill({ status: 404, json: { code: 'APPLICATION_NOT_FOUND', message: '가입 신청을 찾을 수 없습니다.' } });
  });
  await cancel.click();
  await expect(page.getByRole('button', { name: '파도 가입 신청', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: '내 팀', exact: true }).getByRole('button', { name: '팀 만들기', exact: true })).toBeEnabled();
  await expect(page.locator('.success-toast')).toContainText('가입 신청을 찾을 수 없습니다.');
  await expect(page.locator('.success-toast')).not.toContainText('가입 신청을 취소했습니다.');
  expect(attempts).toBe(1);
});

for (const width of [320, 1440]) {
  test(`${width}px 미리보기에서 신청 취소 후 다른 팀에 신청하고 새로고침해도 상태를 유지한다`, async ({ page }) => {
    const apiRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'participant'));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/main');
    const scenario = page.getByLabel('미리보기 상황');
    await scenario.waitFor({ state: 'attached' });
    if (!await scenario.isVisible()) await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
    await scenario.selectOption('building');
    await page.goto('/preview/spaces/1');
    const firstApply = page.getByRole('button', { name: '삼위일체 가입 신청', exact: true });
    const secondApply = page.getByRole('button', { name: '파도 가입 신청', exact: true });
    const firstCancel = page.getByRole('button', { name: '삼위일체 신청 취소', exact: true });
    const secondCancel = page.getByRole('button', { name: '파도 신청 취소', exact: true });
    await expect(firstCancel).toBeEnabled();
    await expect(secondApply).toBeVisible();
    await expect(secondApply).toBeDisabled();
    await page.reload();
    await expect(firstCancel).toBeEnabled();
    await expect(secondApply).toBeDisabled();
    await firstCancel.click();
    await expect(firstApply).toBeEnabled();
    await expect(secondApply).toBeEnabled();
    await secondApply.click();
    await expect(secondCancel).toBeEnabled();
    await expect(firstApply).toBeVisible();
    await expect(firstApply).toBeDisabled();
    await page.reload();
    await expect(secondCancel).toBeEnabled();
    await expect(firstApply).toBeDisabled();
    await secondCancel.click();
    await expect(firstApply).toBeEnabled();
    await expect(secondApply).toBeEnabled();
    await page.reload();
    await expect(firstApply).toBeEnabled();
    await expect(secondApply).toBeEnabled();
    expect(apiRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('팀 생성 후 스페이스 홈의 내 팀을 표시하고 카드를 누를 때 팀 홈으로 이동한다', async ({ page }) => {
  const fixture = await spaceHome(page, { joined: false, empty: true });
  await page.goto('/spaces/1');
  await expect(page.getByText('아직 만들어진 팀이 없습니다.', { exact: true })).toBeVisible();
  const create = page.getByRole('region', { name: '내 팀', exact: true }).getByRole('button', { name: '팀 만들기', exact: true });
  await expect(page.locator('.space-home-section-heading').getByRole('button', { name: '팀 만들기', exact: true })).toHaveCount(0);
  await create.click({ position: { x: 12, y: 12 } });
  const dialog = page.getByRole('dialog', { name: '팀 만들기' });
  await dialog.getByLabel('팀 이름').fill('새로운 팀');
  await dialog.getByRole('button', { name: '팀 만들기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await expect(own).toContainText('새로운 팀');
  await expect(own).toContainText('팀 리더');
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await expect(own.getByRole('button', { name: '팀 만들기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: '팀 목록', exact: true }).getByText('새로운 팀', { exact: true })).toHaveCount(0);
  expect(fixture.writes).toEqual([{ path: '/api/spaces/1/teams', body: { name: '새로운 팀' } }]);
  await page.reload();
  await expect(own).toContainText('새로운 팀');
  await own.getByRole('button', { name: '새로운 팀 팀 홈으로 이동', exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/1\/teams\/3$/);
});

test('가입 상태 조회 실패 시 생성을 막고 다시 불러오면 최신 소속을 표시한다', async ({ page }) => {
  const fixture = await spaceHome(page);
  fixture.setDetailFailure(true);
  await page.goto('/spaces/1');
  await expect(page.getByRole('alert')).toContainText('팀 정보를 불러오지 못했습니다.');
  await expect(page.locator('.space-home-title-row .role-badge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '팀 만들기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '내 팀', exact: true })).toContainText('팀 정보를 다시 불러와 주세요.');
  fixture.setDetailFailure(false);
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('region', { name: '내 팀', exact: true })).toContainText('삼위일체');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.space-home-title-row .role-badge')).toHaveCount(0);
});

test('팀 빌딩 D-day는 날짜 변경과 실제 마감 시각에 맞게 자동 갱신한다', async ({ page }) => {
  const fixture = await spaceHome(page);
  await page.clock.install({ time: new Date('2026-09-01T12:00:00+09:00') });
  fixture.space.teamBuildingOpensAt = '2026-09-01T00:00:00';
  fixture.space.teamBuildingClosesAt = '2026-09-15T23:59:00';
  fixture.space.teamBuildingStatus = 'OPEN';
  await page.goto('/spaces/1');
  const countdown = page.locator('.space-home-countdown');
  await expect(countdown).toHaveText('D-14');
  const status = page.locator('.space-home-period-status');
  const dot = status.locator('.space-home-building-dot');
  await expect(status).toHaveText('진행중');
  await expect(status).toHaveCSS('color', 'rgb(8, 124, 85)');
  await expect(dot).toHaveCSS('background-color', await status.evaluate((element) => getComputedStyle(element).color));
  for (const locator of [
    page.getByRole('heading', { name: '팀 구성', exact: true }),
    page.locator('.space-home-period-status'),
    page.getByRole('term').filter({ hasText: /^프로젝트 기간$/ }),
    page.getByRole('term').filter({ hasText: /^팀 빌딩 기간$/ }),
  ]) await expect(locator).toHaveCSS('font-weight', '700');
  fixture.space.teamBuildingClosesAt = '2026-09-20T23:59:00';
  await page.getByRole('button', { name: '팀 목록 새로고침', exact: true }).click();
  await expect(countdown).toHaveText('D-19');
  await page.clock.setSystemTime(new Date('2026-09-20T23:58:58+09:00'));
  await page.clock.fastForward(1000);
  await expect(countdown).toHaveText('D-day');
  await page.clock.fastForward(1000);
  await expect(countdown).toHaveText('마감');
  await expect(status).toHaveText('고정');
  await expect(dot).toHaveCSS('background-color', await status.evaluate((element) => getComputedStyle(element).color));
  await page.clock.fastForward(86400000);
  await expect(countdown).toHaveText('마감');
  fixture.space.teamBuildingOpensAt = null;
  fixture.space.teamBuildingClosesAt = null;
  await page.getByRole('button', { name: '팀 목록 새로고침', exact: true }).click();
  await expect(countdown).toHaveCount(0);
});

for (const [role, label] of [
  ['leader', '팀 리더'], ['member', '팀원'],
  ['participant', '참여자'], ['manager', '관리자'],
]) {
  test(`${label}의 스페이스 이름 옆에는 역할 배지를 표시하지 않는다`, async ({ page }) => {
    const fixture = await spaceHome(page, { joined: role !== 'participant' });
    if (role === 'manager') fixture.space.myRole = 'MANAGER';
    if (role === 'member') fixture.teams[0].leaderId = 'another-leader';
    if (role === 'participant') fixture.teams[0].myMembershipStatus = 'PENDING';
    await page.goto('/spaces/1');
    const title = page.locator('.space-home-title-row');
    await expect(title.getByRole('heading', { name: '캡스톤 프로젝트', exact: true })).toBeVisible();
    await expect(title.locator('.role-badge')).toHaveCount(0);
  });
}

for (const width of [320, 768, 1440]) {
  test(`${width}px에서 소개·기간·내 팀·다른 팀의 순서와 화면 폭을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await spaceHome(page);
    fixture.teams[0].name = '아주 긴 이름을 사용하는 프로젝트 팀 삼위일체';
    await page.goto('/spaces/1');
    const own = page.getByRole('region', { name: '내 팀', exact: true });
    await expect(own).toContainText(fixture.teams[0].name);
    const intro = await page.locator('.space-home-intro').boundingBox();
    const periods = await page.getByRole('region', { name: '프로젝트 일정' }).boundingBox();
    const ownBox = await own.boundingBox();
    const others = await page.getByRole('region', { name: '팀 목록 1', exact: true }).boundingBox();
    expect(intro.y + intro.height).toBeLessThanOrEqual(periods.y);
    expect(periods.y + periods.height).toBeLessThanOrEqual(ownBox.y);
    expect(ownBox.y + ownBox.height).toBeLessThanOrEqual(others.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 720) {
      const sidebar = await page.locator('.workspace-sidebar').boundingBox();
      expect(intro.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
    }
    const buildingDates = page.locator('.space-home-period').filter({ hasText: '팀 빌딩 기간' }).locator('.space-home-dates');
    const dateLines = await buildingDates.locator('time, .space-home-countdown').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
    expect(Math.max(...dateLines) - Math.min(...dateLines)).toBeLessThan(2);
    if (width > 900) {
      const heading = await page.locator('.space-home-period-summary h2').boundingBox();
      const state = await page.locator('.space-home-period-status').boundingBox();
      const project = await page.getByRole('term').filter({ hasText: /^프로젝트 기간$/ }).boundingBox();
      const building = await page.getByRole('term').filter({ hasText: /^팀 빌딩 기간$/ }).boundingBox();
      expect(Math.abs(heading.y - project.y)).toBeLessThan(1);
      expect(Math.abs(state.y - building.y)).toBeLessThan(1);
    }
  });
}
