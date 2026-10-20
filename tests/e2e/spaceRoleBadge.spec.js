import { test, expect } from '@playwright/test';

async function setup(page, teams, { manager = false, teamStatus = 200 } = {}) {
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { id: 'user-1', name: '김하늘' } }),
  );
  await page.route('**/api/spaces', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          name: '역할 확인 프로젝트',
          myRole: manager ? 'MANAGER' : 'USER',
          teamBuildingStatus: 'LOCKED',
        },
      ],
    }),
  );
  await page.route('**/api/spaces/1/teams', (route) =>
    route.fulfill({
      status: teamStatus,
      json: teamStatus === 200 ? teams : { code: 'SERVER_ERROR' },
    }),
  );
  await page.goto('/main');
  return page
    .getByRole('region', { name: '스페이스 목록', exact: true })
    .locator('.role-badge');
}

test('승인된 팀 리더는 팀 리더로 표시하고 참여 중 필터에 포함한다', async ({
  page,
}) => {
  const badge = await setup(page, [
    { id: 10, leaderId: 'user-1', myMembershipStatus: 'APPROVED' },
  ]);
  await expect(badge).toHaveText('팀 리더');
  await page.getByLabel('내 역할 필터').selectOption('USER');
  await expect(badge).toHaveText('팀 리더');
  await page.reload();
  await expect(badge).toHaveText('팀 리더');
});

for (const [name, teams, label = '참여자'] of [
  [
    '일반 팀원',
    [{ id: 10, leaderId: 'other', myMembershipStatus: 'APPROVED' }],
    '팀원',
  ],
  [
    '다른 팀원',
    [
      {
        id: 10,
        leaderId: 'other',
        myMembershipStatus: 'APPROVED',
      },
    ],
    '팀원',
  ],
  ['팀 미가입', []],
  [
    '가입 대기',
    [{ id: 10, leaderId: 'user-1', myMembershipStatus: 'PENDING' }],
  ],
  [
    '타 팀 리더',
    [
      { id: 10, leaderId: 'other', myMembershipStatus: 'APPROVED' },
      { id: 20, leaderId: 'user-1', myMembershipStatus: null },
    ],
    '팀원',
  ],
]) {
  test(`${name}는 ${label}로 표시한다`, async ({ page }) => {
    await expect(await setup(page, teams)).toHaveText(label);
  });
}

for (const [membership, leaderId, label] of [
  ['APPROVED', 'user-1', '팀 리더'],
  ['APPROVED', 'other', '팀원'],
  ['PENDING', 'user-1', '참여자'],
  ['REJECTED', 'user-1', '참여자'],
  [null, 'other', '참여자'],
]) {
  test(`실제 로그인 목록에 가입 정보가 없으면 팀 상세를 확인해 ${label}로 표시한다 (${membership}, ${leaderId})`, async ({ page }) => {
    let detailCalls = 0;
    await page.route('**/api/teams/10', (route) => {
      detailCalls++;
      return route.fulfill({
        json: { id: 10, spaceId: 1, leaderId, myMembershipStatus: membership },
      });
    });
    const badge = await setup(page, [{ id: 10, name: '목록 요약 팀', approvedMemberCount: 3 }]);
    await expect(badge).toHaveText(label);
    expect(detailCalls).toBeGreaterThan(0);
    await page.reload();
    await expect(badge).toHaveText(label);
  });
}

test('실제 로그인 가입 정보는 새로고침 시 리더·팀원·미가입 상태로 갱신한다', async ({ page }) => {
  let detail = { id: 10, leaderId: 'user-1', myMembershipStatus: 'APPROVED' };
  await page.route('**/api/teams/10', (route) => route.fulfill({ json: detail }));
  const badge = await setup(page, [{ id: 10, name: '목록 요약 팀' }]);
  await expect(badge).toHaveText('팀 리더');
  detail = { ...detail, leaderId: 'other' };
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(badge).toHaveText('팀원');
  detail = { ...detail, myMembershipStatus: null };
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(badge).toHaveText('참여자');
});

test('팀 상세 조회 실패를 미가입 참여자로 표시하지 않는다', async ({ page }) => {
  await page.route('**/api/teams/10', (route) => route.fulfill({ status: 503, json: { code: 'SERVER_ERROR' } }));
  await expect(await setup(page, [{ id: 10, name: '목록 요약 팀' }])).toHaveText('역할 확인 필요');
});

test('관리자는 팀 목록을 추가 조회하지 않고 관리자 표시를 유지한다', async ({
  page,
}) => {
  const calls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/teams'))
      calls.push(request.url());
  });
  await expect(await setup(page, [], { manager: true })).toHaveText('관리자');
  expect(calls).toEqual([]);
});

test('팀 역할 조회 실패는 참여자로 단정하지 않고 새로고침으로 복구한다', async ({
  page,
}) => {
  const badge = await setup(page, [], { teamStatus: 503 });
  await expect(badge).toHaveText('역할 확인 필요');
  await page.route('**/api/spaces/1/teams', (route) =>
    route.fulfill({
      json: [{ id: 10, leaderId: 'user-1', myMembershipStatus: 'APPROVED' }],
    }),
  );
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(badge).toHaveText('팀 리더');
  await page.route('**/api/spaces/1/teams', (route) =>
    route.fulfill({
      json: [{ id: 10, leaderId: 'other', myMembershipStatus: 'APPROVED' }],
    }),
  );
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(badge).toHaveText('팀원');
});

test('팀 역할 조회 중에는 참여자로 잘못 표시하지 않는다', async ({ page }) => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { id: 'user-1', name: '김하늘' } }),
  );
  await page.route('**/api/spaces', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          name: '역할 확인 프로젝트',
          myRole: 'USER',
          teamBuildingStatus: 'OPEN',
        },
      ],
    }),
  );
  await page.route('**/api/spaces/1/teams', async (route) => {
    await pending;
    await route.fulfill({
      json: [{ id: 10, leaderId: 'user-1', myMembershipStatus: 'APPROVED' }],
    });
  });
  await page.goto('/main');
  const badge = page
    .getByRole('region', { name: '스페이스 목록', exact: true })
    .locator('.role-badge');
  await expect(badge).toHaveText('역할 확인 중');
  finish();
  await expect(badge).toHaveText('팀 리더');
});

for (const [role, label] of [
  ['leader', '팀 리더'],
  ['member', '팀원'],
  ['teammate', '팀원'],
  ['participant', '참여자'],
  ['manager', '관리자'],
]) {
  test(`320px ${role} 미리보기에도 실제 역할을 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(
      (role) => localStorage.setItem('fairplay:preview-role', role),
      role,
    );
    await page.goto('/preview/main');
    await expect(
      page
        .getByRole('region', { name: '스페이스 목록', exact: true })
        .locator('.role-badge'),
    ).toHaveText(label);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}
