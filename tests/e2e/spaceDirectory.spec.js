import { test, expect } from '@playwright/test';

const sidebarSpaces = [
  { id: 1, name: '서비스 디자인', myRole: 'USER', teamBuildingStatus: 'OPEN' },
  {
    id: 2,
    name: '캡스톤디자인',
    myRole: 'MANAGER',
    teamBuildingStatus: 'CLOSED',
  },
];

async function directory(page, { spaces = sidebarSpaces, status = 200, teams = [] } = {}) {
  await page.route('**/api/spaces/*/teams', (route) =>
    route.fulfill({ json: teams }),
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { id: 'user-1', name: '박선우' } }),
  );
  await page.route('**/api/spaces', (route) =>
    route.fulfill({
      status,
      json:
        status === 200
          ? spaces
          : { code: 'SERVER_ERROR', message: '목록을 불러오지 못했습니다.' },
    }),
  );
  await page.goto('/main');
  await expect(
    page.getByRole('heading', { name: '내 스페이스', exact: true }),
  ).toBeVisible();
  return page.getByRole('complementary', { name: '스페이스 사이드바' });
}

test('목록 새로고침은 재사용 기간 안에도 최신 스페이스를 표시한다', async ({
  page,
}) => {
  const spaces = [...sidebarSpaces];
  await directory(page, { spaces });
  const list = page.getByRole('region', { name: '스페이스 목록', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  spaces.push({
    id: 3,
    name: '새로 참여한 프로젝트',
    myRole: 'USER',
    teamBuildingStatus: 'CLOSED',
  });
  await page
    .getByRole('main')
    .getByRole('button', { name: '새로고침', exact: true })
    .click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list).toContainText('새로 참여한 프로젝트');
});

test('사이드바의 역할별 보기는 기존 검색과 역할 필터를 함께 유지한다', async ({
  page,
}) => {
  const sidebar = await directory(page);
  const list = page.getByRole('region', { name: '스페이스 목록', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('스페이스 이름 검색').fill('서비스');
  await sidebar.getByRole('button', { name: '참여 중', exact: true }).click();
  await expect(page.getByLabel('내 역할 필터')).toHaveAttribute('data-value', 'USER');
  await expect(page.getByLabel('스페이스 이름 검색')).toHaveValue('서비스');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await sidebar.getByRole('button', { name: '관리 중', exact: true }).click();
  await expect(
    page.getByText('조건에 맞는 스페이스가 없습니다.'),
  ).toBeVisible();
  await page.getByLabel('내 역할 필터').click();
  await page.getByRole('option', { name: '모든 역할', exact: true }).click();
  await expect(
    sidebar.getByRole('button', { name: '내 스페이스', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: '관리 중', exact: true }).click();
  await page.reload();
  await expect(
    sidebar.getByRole('button', { name: '관리 중', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('스페이스 이름 검색')).toHaveValue('서비스');
});

test('사이드바 빠른 실행은 기존 생성·코드 참여 모달을 연다', async ({
  page,
}) => {
  const sidebar = await directory(page);
  await sidebar
    .getByRole('button', { name: '새 스페이스', exact: true })
    .click();
  const modal = page.getByRole('dialog');
  await expect(
    modal.getByRole('heading', { name: '스페이스 만들기', exact: true }),
  ).toBeVisible();
  await expect(modal.getByLabel('스페이스 이름', { exact: true })).toHaveValue(
    '',
  );
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  await sidebar
    .getByRole('button', { name: '스페이스 참여', exact: true })
    .click();
  await expect(
    modal.getByRole('heading', { name: '코드로 참여', exact: true }),
  ).toBeVisible();
  await expect(modal.getByLabel('참여 코드', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page
      .getByRole('main')
      .getByRole('button', { name: '코드로 참여', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('main').getByRole('button', { name: '새 스페이스', exact: true }),
  ).toBeVisible();
});

test('데스크톱 스페이스 사이드바를 접었다가 다시 펼칠 수 있다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() =>
    window.localStorage.removeItem('fairplay:workspace-sidebar-collapsed'),
  );
  await directory(page);
  const sidebar = page.locator('.space-directory-sidebar');
  const rail = page.locator('.space-directory-sidebar-rail');
  const toggle = page.locator('.space-directory-sidebar-toggle');
  const layout = page.locator('.space-directory-layout');

  await expect(toggle).toBeVisible();
  const expandedToggleBox = await toggle.boundingBox();
  await toggle.click();
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(rail).toHaveClass(/is-collapsed/);
  await expect(toggle.locator('.sidebar-toggle-glyph')).toHaveClass(
    /is-collapsed/,
  );
  await expect(layout).toHaveCSS('padding-left', '40px');
  const collapsedToggleBox = await toggle.boundingBox();
  expect(collapsedToggleBox.y).toBe(expandedToggleBox.y);

  await toggle.click();
  await expect(sidebar).not.toHaveClass(/is-collapsed/);
  await expect(layout).toHaveCSS('padding-left', '240px');
});

test('사이드바 바로가기는 조회한 스페이스의 실제 주소로 이동한다', async ({
  page,
}) => {
  const sidebar = await directory(page);
  await page.route('**/api/spaces/1', (route) =>
    route.fulfill({ json: sidebarSpaces[0] }),
  );
  await page.route('**/api/spaces/1/teams', (route) =>
    route.fulfill({ json: [] }),
  );
  await sidebar
    .getByRole('button', {
      name: '스페이스 바로가기: 서비스 디자인',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await expect(
    page.getByRole('heading', { name: '서비스 디자인', exact: true }),
  ).toBeVisible();
});

for (const membership of ['APPROVED', 'PENDING', 'REJECTED', null]) {
  test(`로그인 바로가기는 상세에서 가입 상태 ${membership}를 확인해 이동한다`, async ({ page }) => {
    const team = {
      id: 10, spaceId: 1, name: '내 프로젝트 팀', leaderId: 'user-1',
      myMembershipStatus: membership, approvedMemberCount: 3,
    };
    await page.route('**/api/spaces/1', route => route.fulfill({ json: sidebarSpaces[0] }));
    await page.route('**/api/teams/10', route => route.fulfill({ json: team }));
    await page.route('**/api/teams/20', route => route.fulfill({ json: {
      id: 20, spaceId: 1, name: '다른 팀', leaderId: 'other', myMembershipStatus: null,
    } }));
    await page.route('**/api/teams/10/members', route => route.fulfill({ json: [{ userId: 'user-1', name: '박선우', role: 'LEADER' }] }));
    await page.route('**/api/teams/10/deletion-request', route => route.fulfill({ status: 404, json: { code: 'TEAM_DELETION_REQUEST_NOT_FOUND' } }));
    await page.route('**/api/teams/10/my-work-summary', route => route.fulfill({ json: {
      teamProgressRate: 0, myAssignedShare: 0, myCompletedContributionRate: 0,
      myTaskCompletionRate: null, myOverdueTaskCount: 0,
    } }));
    const sidebar = await directory(page, { teams: [
      { id: 20, name: '다른 팀', leaderId: 'other', myMembershipStatus: null },
      { id: 10, name: '팀 목록 요약' },
    ] });
    const shortcut = sidebar.getByRole('button', {
      name: membership === 'APPROVED' ? '팀 바로가기: 내 프로젝트 팀' : '스페이스 바로가기: 서비스 디자인',
      exact: true,
    });
    await expect(shortcut.locator('.directory-shortcut-name')).toHaveText(membership === 'APPROVED' ? team.name : sidebarSpaces[0].name);
    await expect(shortcut.locator(membership === 'APPROVED' ? '.directory-shortcut-symbol .lucide-users-round' : '.directory-shortcut-symbol .lucide-layout-grid')).toBeVisible();
    await shortcut.click();
    await expect(page).toHaveURL(membership === 'APPROVED' ? /\/spaces\/1\/teams\/10$/ : /\/spaces\/1$/);
    await expect(page.getByRole('heading', { name: membership === 'APPROVED' ? team.name : sidebarSpaces[0].name, exact: true })).toBeVisible();
  });
}

test('바로가기 조회 실패 시 목록에 머물고 다시 시도할 수 있다', async ({ page }) => {
  const sidebar = await directory(page);
  await expect(page.locator('.space-list .role-badge').first()).toHaveText('참여자');
  await page.route('**/api/spaces/1/teams', route => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '이동할 팀을 확인하지 못했습니다.' } }));
  await sidebar.getByRole('button', { name: '스페이스 바로가기: 서비스 디자인', exact: true }).click();
  await expect(page).toHaveURL(/\/main$/);
  await expect(page.getByRole('alert')).toContainText('이동할 팀을 확인하지 못했습니다.');
  await page.route('**/api/spaces/1/teams', route => route.fulfill({ json: [] }));
  await page.route('**/api/spaces/1', route => route.fulfill({ json: sidebarSpaces[0] }));
  await page.getByRole('alert').getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page).toHaveURL(/\/spaces\/1$/);
});

test('미리보기 사이드바는 서버 요청 없이 내 팀 홈으로 바로 이동한다', async ({
  page,
}) => {
  const calls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      calls.push(request.url());
  });
  await page.goto('/preview/main');
  const sidebar = page.getByRole('complementary', {
    name: '스페이스 사이드바',
  });
  await expect(sidebar.locator('.directory-shortcut-name')).toHaveText('삼위일체');
  await expect(sidebar.locator('.directory-shortcut-symbol .lucide-users-round')).toBeVisible();
  await sidebar
    .getByRole('button', {
      name: '팀 바로가기: 삼위일체',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/preview\/spaces\/1\/teams\/1$/);
  expect(calls).toEqual([]);
});

for (const [role, destination] of [
  ['member', /\/preview\/spaces\/1\/teams\/1$/],
  ['teammate', /\/preview\/spaces\/1\/teams\/1$/],
  ['participant', /\/preview\/spaces\/1$/],
  ['manager', /\/preview\/spaces\/1$/],
]) {
  test(`${role} 미리보기 바로가기는 본인 가입 상태에 맞는 홈으로 이동한다`, async ({ page }) => {
    await page.addInitScript(role => localStorage.setItem('fairplay:preview-role', role), role);
    await page.goto('/preview/main');
    await page.getByRole('complementary', { name: '스페이스 사이드바' })
      .getByRole('button', {
        name: ['member', 'teammate'].includes(role)
          ? '팀 바로가기: 삼위일체'
          : '스페이스 바로가기: 2026 서비스 디자인 프로젝트',
        exact: true,
      }).click();
    await expect(page).toHaveURL(destination);
  });
}

test('빈 목록이나 조회 오류에서는 사이드바에 가짜 스페이스를 표시하지 않는다', async ({
  page,
}) => {
  const sidebar = await directory(page, { spaces: [] });
  await expect(
    sidebar.getByText('참여한 스페이스가 여기에 표시됩니다.'),
  ).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: /^(팀|스페이스) 바로가기:/ }),
  ).toHaveCount(0);
  await directory(page, { status: 500 });
  await expect(sidebar.getByText('목록을 불러오지 못했습니다.')).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: /^(팀|스페이스) 바로가기:/ }),
  ).toHaveCount(0);
});

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`${width}px 내 스페이스 사이드바와 기존 목록은 겹치지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const sidebar = await directory(page);
    const main = page.getByRole('main');
    await expect(
      main.getByRole('region', { name: '스페이스 목록', exact: true }),
    ).toBeVisible();
    if (width > 720) {
      const left = await sidebar.boundingBox();
      const right = await main.boundingBox();
      expect(left.x + left.width).toBeLessThanOrEqual(right.x);
      await expect(
        sidebar.getByRole('button', { name: '내 스페이스', exact: true }),
      ).toBeVisible();
    } else {
      const toggle = sidebar.getByRole('button', {
        name: '스페이스 메뉴',
        exact: true,
      });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(
        sidebar.getByRole('button', {
          name: '관리 중',
          exact: true,
          includeHidden: true,
        }),
      ).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await sidebar
        .getByRole('button', { name: '관리 중', exact: true })
        .click();
      await expect(page.getByLabel('내 역할 필터')).toHaveAttribute('data-value', 'MANAGER');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('스페이스 이름과 내 역할 조건을 함께 적용하고 초기화 후 이동할 수 있다', async ({
  page,
}) => {
  await page.route('**/api/spaces/*/teams', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { id: 'user-1', name: '테스트 사용자' } }),
  );
  const spaces = [
    {
      id: 1,
      name: '서비스 디자인',
      myRole: 'USER',
      teamBuildingStatus: 'OPEN',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
    {
      id: 2,
      name: '서비스 개발',
      myRole: 'MANAGER',
      teamBuildingStatus: 'NOT_CONFIGURED',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
    {
      id: 3,
      name: '공모전',
      myRole: 'USER',
      teamBuildingStatus: 'CLOSED',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
  ];
  await page.route('**/api/spaces', (route) => route.fulfill({ json: spaces }));
  await page.goto('/main');
  const list = page.getByRole('region', { name: '스페이스 목록', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('스페이스 이름 검색').fill('서비스');
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('내 역할 필터').click();
  await page.getByRole('option', { name: '참여 중', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('서비스 디자인');
  await page.reload();
  await expect(page.getByLabel('스페이스 이름 검색')).toHaveValue('서비스');
  await expect(page.getByLabel('내 역할 필터')).toHaveAttribute('data-value', 'USER');
  await page.route('**/api/spaces/1', (route) =>
    route.fulfill({ json: spaces[0] }),
  );
  await page.route('**/api/spaces/1/teams', (route) =>
    route.fulfill({ json: [] }),
  );
  await list.getByRole('button').filter({ hasText: '서비스 디자인' }).click();
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await page.goBack();
  await expect(page.getByLabel('스페이스 이름 검색')).toHaveValue('서비스');
  await expect(page.getByLabel('내 역할 필터')).toHaveAttribute('data-value', 'USER');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.getByLabel('스페이스 이름 검색').fill('없는 공간');
  await expect(
    page.getByText('조건에 맞는 스페이스가 없습니다.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '검색·필터 초기화' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.route('**/api/spaces/2', (route) =>
    route.fulfill({
      json: {
        ...spaces[1],
        teamBuildingOpensAt: null,
        teamBuildingClosesAt: null,
      },
    }),
  );
  await page.route('**/api/spaces/2/teams', (route) =>
    route.fulfill({ json: [] }),
  );
  await list.getByRole('button').filter({ hasText: '서비스 개발' }).click();
  await expect(page).toHaveURL(/\/spaces\/2$/);
  await expect(
    page.getByRole('heading', { name: '서비스 개발', exact: true }),
  ).toBeVisible();
});
