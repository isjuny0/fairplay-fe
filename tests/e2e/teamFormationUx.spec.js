import { test, expect } from '@playwright/test';

async function teamFormation(page, { period = 'OPEN', joined = true, pending = true } = {}) {
  const members = [
    { userId: 'leader', name: '김하늘', role: 'LEADER' },
    { userId: 'member', name: '이지원', role: 'MEMBER' },
    { userId: 'other-member', name: '박서연', role: 'MEMBER' },
  ];
  const team = {
    id: 1,
    spaceId: 1,
    name: '삼위일체',
    leaderId: 'leader',
    approvedMemberCount: 3,
    myMembershipStatus: joined ? 'APPROVED' : pending ? 'PENDING' : null,
    canApply: false,
    teamBuildingStatus: period,
  };
  const space = {
    id: 1,
    name: '프로젝트',
    myRole: 'USER',
    teamBuildingStatus: period,
    startAt: '2026-01-01T00:00:00',
    endAt: '2030-12-31T00:00:00',
    teamBuildingOpensAt:
      period === 'NOT_CONFIGURED' ? null : '2026-01-01T00:00:00',
    teamBuildingClosesAt:
      period === 'NOT_CONFIGURED' ? null : '2030-01-01T00:00:00',
  };
  let applications = [
    {
      id: 7,
      name: '한지민',
      userId: 'applicant',
      requestedAt: '2026-10-01T12:00:00',
      canApprove: true,
    },
  ];
  const mutations = [];
  let failReads = false;
  let failMutation = false;
  let releaseMutation;
  let mutationGate;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (!path.startsWith('/api/')) return route.continue();
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/me')
      return reply({
        id: joined ? 'leader' : 'applicant',
        name: joined ? '김하늘' : '한지민',
      });
    if (path === '/api/auth/csrf')
      return reply({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path === '/api/spaces') return reply([space]);
    if (path === '/api/spaces/1') return reply(space);
    if (path === '/api/spaces/1/teams') return reply([team]);
    if (path === '/api/teams/1') return reply(team);
    if (path === '/api/teams/1/deletion-request')
      return reply(
        {
          code: 'TEAM_DELETION_REQUEST_NOT_FOUND',
          message: '삭제 요청이 없습니다.',
        },
        404,
      );
    if (path === '/api/teams/1/members')
      return failReads
        ? reply(
            { code: 'READ_FAILED', message: '팀원 목록을 확인할 수 없습니다.' },
            500,
          )
        : reply(members);
    if (path === '/api/teams/1/applications') return reply(applications);
    if (method === 'PATCH') {
      const body = request.postDataJSON();
      mutations.push({ path, body });
      if (mutationGate) await mutationGate;
      if (failMutation)
        return reply(
          {
            code: 'UPDATE_FAILED',
            message: '팀원 상태를 변경하지 못했습니다.',
          },
          409,
        );
      if (path === '/api/team-applications/7') {
        applications = [];
        if (body.status === 'APPROVED') {
          members.push({ userId: 'applicant', name: '한지민', role: 'MEMBER' });
          team.approvedMemberCount++;
        }
        return reply({ id: 7, status: body.status });
      }
    }
    return reply(
      { code: 'UNEXPECTED_TEST_API', message: `${method} ${path}` },
      501,
    );
  });
  return {
    mutations,
    failReads: (value) => {
      failReads = value;
    },
    failMutation: (value) => {
      failMutation = value;
    },
    pauseMutation: () => {
      mutationGate = new Promise((resolve) => {
        releaseMutation = resolve;
      });
    },
    releaseMutation: () => releaseMutation(),
  };
}





for (const status of ['APPROVED', 'REJECTED']) {
  test(`가입 신청 ${status} 결과에 대상과 동작을 표시한다`, async ({
    page,
  }) => {
    const fixture = await teamFormation(page);
    await page.goto('/spaces/1/teams/1/members');
    await page
      .getByRole('button', {
        name: status === 'APPROVED' ? '가입 승인' : '반려',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('status').filter({
        hasText: `한지민님의 가입 신청을 ${status === 'APPROVED' ? '승인' : '반려'}했습니다.`,
      }),
    ).toBeVisible();
    expect(fixture.mutations).toEqual([
      { path: '/api/team-applications/7', body: { status } },
    ]);
  });
}

for (const [period, joined, reason] of [
  ['OPEN', true, '이미 삼위일체 팀에 소속되어 있습니다.'],
  ['NOT_CONFIGURED', false, '관리자가 팀 빌딩 기간을 지정하면'],
  ['SCHEDULED', false, '팀 빌딩이 시작되는'],
  ['CLOSED', false, '팀 빌딩 기간이 종료되어'],
  ['LOCKED', false, '평가가 시작되어 팀 구성이 고정'],
]) {
  test(`팀 생성 제한 ${period}·소속 ${joined} 이유와 소속 상태를 표시한다`, async ({
    page,
  }) => {
    await teamFormation(page, { period, joined, pending: false });
    await page.goto('/spaces/1');
    const create = page.getByRole('button', { name: '팀 만들기', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (joined) {
      await expect(page.getByRole('region', { name: '내 팀', exact: true })).toContainText('삼위일체');
      await expect(create).toHaveCount(0);
    } else {
      await expect(create).toBeDisabled();
      await expect(create).toHaveAccessibleDescription(new RegExp(reason));
      await expect(page.getByText('가입 승인 대기', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('region', { name: '내 팀', exact: true })).toContainText('팀 만들기');
    }
  });
}
