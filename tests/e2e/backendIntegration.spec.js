import { koreanDateTime } from '../../src/lib/koreanTime.js';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { fillDateTime } from './helpers/dateTime.js';
import { openCalendarEventEditor, addDashboardWidgets } from './helpers/teamDashboard.js';

const members = [
  {
    userId: '00000000-0000-4000-8000-000000000001',
    name: '담당자',
    role: 'MEMBER',
  },
  {
    userId: '00000000-0000-4000-8000-000000000002',
    name: '리더',
    role: 'LEADER',
  },
];
async function backend(
  page,
  {
    manager = false,
    roundStatus = 'OPEN',
    participating = true,
    reportReady = false,
    reportId = null,
    reportStatus = null,
  } = {},
) {
  const requests = [];
  let calendarEvents = [];
  let homePreferences = { teamId: 1, widgets: ['calendar', 'progress', 'contribution'], memo: '' };
  const space = {
    id: 1,
    name: '실제 API 스페이스',
    myRole: manager ? 'MANAGER' : 'USER',
    version: 1,
    teamBuildingStatus: 'CLOSED',
    teamBuildingOpensAt: '2026-01-01T09:00:00',
    teamBuildingClosesAt: '2026-01-02T09:00:00',
  };
  const team = {
    id: 1,
    spaceId: 1,
    name: '실제 API 팀',
    leaderId: members[1].userId,
    approvedMemberCount: 2,
    myMembershipStatus: manager ? null : 'APPROVED',
    canCreateTask: !manager,
    canApply: false,
  };
  const rounds = [
    {
      id: 11,
      spaceId: 1,
      type: 'MID',
      status: roundStatus,
      version: 3,
      participantCount: 2,
      mySubmissionStatus:
        manager || !participating ? 'NOT_PARTICIPATING' : 'NOT_SUBMITTED',
      opensAt: '2026-01-03T09:00:00',
      closesAt: '2030-12-01T18:00:00',
    },
  ];
  if (reportReady)
    rounds.push({ ...rounds[0], id: 12, type: 'FINAL', status: 'CLOSED' });
  const task = {
    id: 10,
    teamId: 1,
    title: '현재 작업',
    description: '연결 자료에 근거한 작업 설명입니다.',
    status: 'IN_PROGRESS',
    version: 2,
    weight: 3,
    startAt: '2030-11-01T09:00:00',
    dueAt: '2030-12-01T18:00:00',
    assignees: [{ userId: members[0].userId, allocationPercent: 100 }],
    completionBlockReason: null,
  };
  let response =
    roundStatus === 'CLOSED'
      ? {
          roundId: 11,
          targetId: members[1].userId,
          scores: {
            taskExecution: 4,
            responsibility: 3,
            collaboration: 5,
            communication: 4,
          },
          reason: '마감된 내 응답',
          updatedAt: '2026-10-14T19:00:00',
          submittedAt: '2026-10-14T19:01:00',
        }
      : null;
  let review = null;
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method();
    if (!path.startsWith('/api/')) return route.continue();
    requests.push({
      path,
      method,
      query: url.search,
      body: request.postData(),
      headers: request.headers(),
    });
    const respond = (json, status = 200) => route.fulfill({ status, json });
    if (path === '/api/teams/1/home-preferences/me') {
      if (method === 'PATCH') homePreferences = { ...homePreferences, ...request.postDataJSON() };
      return respond(homePreferences);
    }
    if (path === '/api/teams/1/calendar-events') {
      if (method === 'GET') return respond(calendarEvents);
      const event = { ...request.postDataJSON(), id: calendarEvents.length + 1, teamId: 1, version: 0, authorId: members[0].userId };
      calendarEvents.push(event);
      return respond(event, 201);
    }
    if (path === '/api/tasks/10/comments' && method === 'GET') return respond([]);
    if (path === '/api/me')
      return respond({
        id: manager
          ? '00000000-0000-4000-8000-000000000003'
          : members[0].userId,
        name: manager ? '관리자' : '담당자',
      });
    if (path === '/api/auth/csrf')
      return respond({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path === '/api/spaces') return respond([space]);
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/announcements') return respond([]);
    if (path === '/api/spaces/1/teams') return respond([team]);
    if (path === '/api/teams/1') return respond(team);
    if (path === '/api/teams/1/members') return respond(members);
    if (path === '/api/teams/1/deletion-request')
      return respond(
        { code: 'TEAM_DELETION_REQUEST_NOT_FOUND', message: '삭제 요청 없음' },
        404,
      );
    if (path === '/api/teams/1/tasks') return respond([task]);
    if (path === '/api/tasks/10')
      return respond({
        task,
        contributions: [
          {
            userId: members[0].userId,
            contributionDescription: '수행 설명입니다.',
          },
        ],
        deliverableSummary: [],
      });
    if (path === '/api/teams/1/deliverables') return respond([]);
    if (path === '/api/teams/1/my-work-summary')
      return respond({
        teamId: 1,
        asOf: '2026-10-14T19:00:00',
        teamTotalWeight: 0,
        teamDoneWeight: 0,
        myAssignedWeight: 0,
        myDoneWeight: 0,
        teamProgressRate: null,
        myAssignedShare: null,
        myCompletedContributionRate: null,
        myTaskCompletionRate: null,
        myOverdueTaskCount: 9,
      });
    if (path === '/api/spaces/1/evaluation-rounds') {
      if (method === 'POST') {
        const created = {
          ...request.postDataJSON(),
          id: 12,
          spaceId: 1,
          version: 0,
          status: 'DRAFT',
          participantCount: 0,
          mySubmissionStatus: 'NOT_PARTICIPATING',
        };
        rounds.push(created);
        return respond(created, 201);
      }
      return respond(rounds);
    }
    if (path === '/api/evaluation-rounds/11') {
      Object.assign(rounds[0], request.postDataJSON(), {
        version: rounds[0].version + 1,
      });
      return respond(rounds[0]);
    }
    if (path === '/api/evaluation-rounds/11/open') {
      rounds[0].status = 'OPEN';
      space.membershipLockedAt = '2026-10-14T19:00:00';
      return respond(rounds[0]);
    }
    if (path === '/api/evaluation-rounds/11/targets')
      return respond([
        {
          targetId: members[1].userId,
          name: members[1].name,
          teamId: 1,
          hasSavedResponse: Boolean(response),
          submittedAt: response?.submittedAt || null,
        },
      ]);
    if (/^\/api\/evaluation-rounds\/\d+\/teams\/1\/responses$/.test(path))
      return respond({
        roundId: Number(path.split('/')[3]),
        type: 'MID',
        teamId: 1,
        requiredCount: 2,
        submittedCount: 0,
        missingCount: 2,
        responses: [],
      });
    if (path === '/api/evaluation-rounds/11/responses/me')
      return respond(response ? [response] : []);
    if (path === `/api/evaluation-rounds/11/responses/${members[1].userId}`) {
      response = {
        ...request.postDataJSON(),
        roundId: 11,
        targetId: members[1].userId,
        updatedAt: koreanDateTime(),
        submittedAt: null,
      };
      return respond(response);
    }
    if (path === '/api/evaluation-rounds/11/submit') {
      response.submittedAt = '2026-10-14T19:00:00';
      rounds[0].mySubmissionStatus = 'SUBMITTED';
      return respond({ roundId: 11, submittedAt: response.submittedAt });
    }
    if (path === '/api/teams/1/mid-feedback')
      return respond({
        roundId: 11,
        teamId: 1,
        asOf: '2026-10-14T19:00:00',
        members: [
          {
            userId: members[0].userId,
            name: '담당자',
            receivedEvaluationCount: 1,
            averageScores: {
              taskExecution: 4.25,
              responsibility: 3,
              collaboration: 2,
              communication: 4,
            },
            improvementGuidance: ['역할 조율을 함께 확인해 보세요.'],
          },
        ],
      });
    if (path === '/api/spaces/1/manager-dashboard')
      return respond({
        spaceId: 1,
        spaceName: space.name,
        teamId: url.searchParams.has('teamId') ? 1 : null,
        asOf: '2026-10-14T19:00:00',
        totalTeamCount: 1,
        unassignedCount: 2,
        pendingApplications: 1,
        overdueTaskCount: 2,
        staleTaskCount: 3,
        revisingTaskCount: 1,
        teams: [
          {
            teamId: 1,
            teamName: team.name,
            leaderName: '리더',
            leaderId: members[1].userId,
            approvedMemberCount: 2,
            hasMinimumMembers: true,
            pendingApplications: 1,
            totalTaskCount: 3,
            todoTaskCount: 1,
            inProgressTaskCount: 1,
            revisingTaskCount: 0,
            doneTaskCount: 1,
            completionRate: 25,
            overdueTaskCount: 2,
            staleTaskCount: 3,
            deliverableCount: 4,
            reportId,
            reportStatus,
            ...(url.searchParams.has('teamId')
              ? {
                  members: members.map((member) => ({
                    userId: member.userId,
                    name: member.name,
                    assignedTaskCount: 1,
                    todoTaskCount: 0,
                    inProgressTaskCount: 1,
                    revisingTaskCount: 0,
                    doneTaskCount: 0,
                    overdueTaskCount: 0,
                    completedWorkWeight: 0,
                    missingContributionDescriptionCount: 1,
                  })),
                }
              : {}),
          },
        ],
        missingPeerSubmissions: reportReady
          ? rounds.map((round) => ({
              roundId: round.id,
              type: round.type,
              status: round.status,
              requiredCount: 4,
              submittedCount: 2,
              missingCount: 2,
              teams: [
                {
                  teamId: 1,
                  requiredCount: 2,
                  submittedCount: 2,
                  missingCount: 0,
                },
                {
                  teamId: 2,
                  requiredCount: 2,
                  submittedCount: 0,
                  missingCount: 2,
                },
              ],
            }))
          : [
              {
                roundId: 11,
                type: 'MID',
                status: roundStatus,
                requiredCount: roundStatus === 'DRAFT' ? 0 : 2,
                submittedCount: 0,
                missingCount: roundStatus === 'DRAFT' ? 0 : 2,
                teams: [],
              },
            ],
      });
    if (path === '/api/tasks/10/ai-review') {
      if (method === 'POST') {
        review = {
          id: 1,
          taskId: 10,
          status: 'PENDING',
          isCurrent: true,
          summary: null,
          strengths: [],
          improvements: [],
          limitations: [],
          failureCode: null,
          failureDeliverableId: null,
          createdAt: '2026-10-14T19:00:00',
          updatedAt: '2026-10-14T19:00:00',
        };
        return respond(review, 202);
      }
      return review
        ? respond(review)
        : respond(
            { code: 'AI_REVIEW_NOT_FOUND', message: '검토 기록이 없습니다.' },
            404,
          );
    }
    return respond({ code: 'NOT_FOUND', message: `미지원 ${path}` }, 404);
  });
  return {
    requests,
    rounds,
    setTask(values) {
      Object.assign(task, values);
    },
    setReview(value) {
      review = value;
    },
  };
}

test('일반 팀 홈은 서버 본인 집계를 사용하고 null을 0%로 표시하지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1');
  await addDashboardWidgets(page, ['지금 확인할 작업', '내 작업 현황']);
  await expect(
    page.getByRole('button', { name: /내 마감 지연.*9건/ }),
  ).toBeVisible();
  await expect(page.getByText('계산할 작업 없음').first()).toBeVisible();
  await expect(page.locator('.home-progress-ring')).not.toHaveAttribute('aria-valuenow');
  const actions = await page.getByRole('region', { name: '지금 확인할 작업' }).boundingBox();
  await expect(page.locator('.widget-mywork')).toBeVisible();
  const ownWork = await page.getByRole('region', { name: '본인 작업 현황' }).boundingBox();
  expect(ownWork.y).toBeGreaterThanOrEqual(actions.y);
  await page.getByRole('button', { name: '내 작업 현황 계산 기준', exact: true }).click();
  const definitions = page.getByRole('dialog', { name: '내 작업 현황 계산 기준', exact: true });
  await expect(definitions.locator('.home-definition-body > p').first()).toBeVisible();
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
  expect(
    requests.some((request) => request.path.endsWith('/my-work-summary')),
  ).toBeTruthy();
});
test('팀 홈은 확인할 작업이 없음을 안내하고 계산할 작업 없음과 0%를 구분한다', async ({ page }) => {
  await backend(page);
  await page.route('**/api/teams/1/my-work-summary', route => route.fulfill({
    json: {
      teamId: 1, asOf: '2026-10-18T19:00:00',
      teamTotalWeight: 3, teamDoneWeight: 0, myAssignedWeight: 0, myDoneWeight: 0,
      teamProgressRate: 0, myAssignedShare: 0, myCompletedContributionRate: 0,
      myTaskCompletionRate: null, myOverdueTaskCount: 0,
    },
  }));
  await page.goto('/spaces/1/teams/1');
  await addDashboardWidgets(page, ['지금 확인할 작업', '내 작업 현황', '다가오는 작업']);
  await expect(page.getByText('확인할 작업 없음', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /내 마감 지연.*0건/ })).toBeEnabled();
  const ownWork = page.getByRole('region', { name: '본인 작업 현황' });
  await expect(ownWork.getByText('0.00%', { exact: true })).toHaveCount(2);
  await expect(ownWork.getByText('담당 작업 없음', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '예상 작업량을 반영한 팀 진행률' })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.home-ring-value')).toHaveAttribute('stroke-opacity', '0');
  await page.getByRole('button', { name: '내 작업 전체 보기', exact:true }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('ALL');
});
test('다가오는 작업 위젯은 실제 작업 상세로 이동한다', async ({ page }) => {
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1');
  await addDashboardWidgets(page, ['다가오는 작업']);
  await page.locator('.widget-upcoming').getByRole('button', { name: /현재 작업/ }).click();
  await expect(page).toHaveURL(/\/tasks\/10$/);
  await expect(page.getByRole('heading', { name: '현재 작업', exact: true })).toBeVisible();
  expect(requests.some(request => request.path === '/api/teams/1/tasks')).toBe(true);
});

test('내 기여도는 공개된 최종 리포트만 사용하고 현재 완료 비중으로 대체하지 않는다', async ({ page }) => {
  await backend(page);
  let status = 'PUBLISHED';
  await page.route('**/api/teams/1/report', route => route.fulfill({ json: { status, weights: { taskPercent: 50, midPercent: 20, finalPercent: 30 }, myDetails: { totalPercent: 63.4 }, members: [] } }));
  await page.goto('/spaces/1/teams/1');
  const contribution = page.getByRole('region', { name: '내 기여도', exact: true });
  await expect(contribution.locator('.dashboard-contribution-result > strong')).toHaveText('63.40%');
  await contribution.getByRole('button', { name: '내 기여도 계산 기준', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 기여도 계산 기준', exact: true })).toContainText('완료 작업 · 50%');
  await page.keyboard.press('Escape');
  status = 'UNPUBLISHED';
  await page.reload();
  await expect(contribution.getByText('공개 대기', { exact: true })).toBeVisible();
  await expect(contribution.locator('.dashboard-contribution-result > strong')).toHaveText('—');
});

test('서버 조회 오류를 예시 현황으로 대체하지 않는다', async ({ page }) => {
  await backend(page);
  await page.route('**/api/teams/1/my-work-summary', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'UNAVAILABLE', message: '실제 현황 조회 실패' },
    }),
  );
  await page.goto('/spaces/1/teams/1');
  await expect(page.getByRole('alert')).toContainText('실제 현황 조회 실패');
  await openCalendarEventEditor(page);
  const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
  await editor.getByLabel('일정 이름', { exact: true }).fill('API 오류 중에도 회의 추가');
  await editor.getByRole('button', { name: '일정 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: 'API 오류 중에도 회의 추가 일정 수정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /내 승인 대기/ })).toHaveCount(
    0,
  );
});
test('실제 작업 상세는 완료 조건을 읽기 전용 체크리스트로 표시한다', async ({ page }) => {
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1/tasks/10');
  await expect(page.getByRole('heading', { name: '현재 작업', exact: true })).toBeVisible();
  const readiness = page.getByRole('list', { name: '완료 준비 상태' });
  await expect(readiness.getByRole('img', { name: '충족', exact: true })).toHaveCount(2);
  await expect(readiness.getByRole('img', { name: '미충족', exact: true })).toHaveCount(1);
  await expect(readiness.getByRole('checkbox')).toHaveCount(0);
  await readiness.getByRole('img', { name: '미충족', exact: true }).click();
  await expect(page.locator('.task-detail-page .status-badge')).toHaveText('진행 중');
  await expect(page.getByRole('button', { name: '완료 처리', exact: true })).toBeDisabled();
  expect(requests.some(({ method }) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))).toBe(false);
});

test('동료 평가는 실제 PUT과 POST로 저장·제출하고 새로고침 후 잠근다', async ({
  page,
}) => {
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1/peer-evaluations');
  await expect(page.locator('.score-scale').first().locator('span')).toHaveText([
    '매우 미흡', '미흡', '보통', '우수', '매우 우수',
  ]);
  for (const label of ['작업 수행', '책임감', '적극성', '의사소통'])
    await page.getByLabel(`리더 ${label} 4점`, { exact: true }).check();
  await page.getByRole('button', { name: '리더 평가 저장' }).click();
  await page.getByRole('button', { name: '최종 제출', exact: true }).click();
  await page.getByRole('button', { name: '제출 확정' }).click();
  await expect(page.getByText('최종 제출 완료', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('리더 작업 수행 4점')).toBeDisabled();
  const save = requests.find((request) => request.method === 'PUT');
  expect(JSON.parse(save.body)).toEqual({
    scores: {
      taskExecution: 4,
      responsibility: 4,
      collaboration: 4,
      communication: 4,
    },
    reason: null,
  });
  expect(save.headers['x-csrf-token']).toBe('test-token');
  expect(
    requests.find((request) => request.path.endsWith('/submit')).body,
  ).toBeNull();
});
test('마감된 회차는 대상 조회 없이 본인 저장 응답만 읽고 비참여 회차는 조회하지 않는다', async ({
  page,
}) => {
  const { requests } = await backend(page, { roundStatus: 'CLOSED' });
  await page.goto('/spaces/1/teams/1/peer-evaluations');
  await expect(page.getByText('마감된 내 응답', { exact: true })).toBeVisible();
  await expect(page.getByLabel('리더 작업 수행 4점')).toBeDisabled();
  expect(
    requests.some((request) => request.path.endsWith('/targets')),
  ).toBeFalsy();
});
test('평가 비참여 상태는 대상·응답 조회를 요청하지 않는다', async ({
  page,
}) => {
  const { requests } = await backend(page, { participating: false });
  await page.goto('/spaces/1/teams/1/peer-evaluations');
  await expect(
    page.getByText('이 평가 회차의 고정 참여자가 아닙니다.'),
  ).toBeVisible();
  expect(
    requests.some((request) => /targets|responses/.test(request.path)),
  ).toBeFalsy();
});
test('중간 피드백은 서버 평균을 네 항목으로 표시하고 집계 안내를 제공한다', async ({
  page,
}) => {
  await backend(page);
  await page.goto('/spaces/1/teams/1/mid-feedback');
  await expect(page.getByText('4.25 / 5', { exact: true })).toBeVisible();
  await expect(page.getByText('역할 조율을 함께 확인해 보세요.')).toHaveCount(0);
  await expect(page.getByLabel('평가 정보')).toContainText('받은 평가 1개');
  await expect(page.getByRole('meter')).toHaveCount(4);
  await expect(page.getByRole('meter', { name: '작업 수행 평균', exact: true })).toHaveAttribute('aria-valuenow', '4.25');
  await expect(page.locator('.feedback-score-row.needs-attention')).toHaveCount(1);
  await expect(page.locator('.feedback-score-row.needs-attention')).toContainText('적극성');
  await expect(page.locator('.feedback-score-row.needs-attention')).toContainText('확인할 항목');
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '내 담당 작업 보기', exact: true })).toHaveCount(0);
  await expect(page.getByText('평가 기준 보기', { exact: true })).toHaveCount(0);
  await expect(page.locator('.feedback-calculation-note')).toContainText('최종 기여율과는 별개');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  for (const label of ['작업 수행', '책임감', '적극성', '의사소통']) {
    const help = page.getByRole('button', { name: `${label} 설명`, exact: true });
    await help.hover();
    await expect(page.getByRole('tooltip')).toContainText('확인합니다.');
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await help.focus();
    await expect(help).toHaveAttribute('aria-describedby', await page.getByRole('tooltip').getAttribute('id'));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(help).toBeFocused();
    await help.blur();
  }
  const items = await page.locator('.feedback-score-row').all();
  const boxes = await Promise.all(items.map((item) => item.boundingBox()));
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBoxes = await Promise.all(items.map((item) => item.boundingBox()));
  expect(mobileBoxes[1].y).toBeGreaterThanOrEqual(mobileBoxes[0].y + mobileBoxes[0].height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('팀 관리은 현재 DTO의 가중 진행률과 선택 팀 구성원을 표시한다', async ({
  page,
}) => {
  const { requests } = await backend(page, {
    manager: true,
    roundStatus: 'DRAFT',
  });
  await page.goto('/spaces/1/dashboard');
  await expect(page.getByText('25%', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '전체 팀 현황', exact: true })).toHaveCount(0);
  await expect(page.getByText('AI 확인 필요', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('columnheader', { name: '리포트', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: /팀원 수행 현황/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '실제 API 팀 현황 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '팀원 수행 현황' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '평가 현황', exact: true })).toHaveCount(0);
  expect(
    requests.some(
      (request) =>
        request.path.endsWith('manager-dashboard') &&
        request.query === '?teamId=1',
    ),
  ).toBeTruthy();
});
test('관리자 팀 목록은 팀 수행 현황과 팀원 기록을 거쳐도 긴 목록의 위치와 조회 조건을 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await backend(page, { manager: true });
  await page.route('**/api/teams/1/members/*/contributions', (route) => route.fulfill({ json: [{
    taskId: 10, title: '담당 작업', status: 'IN_PROGRESS', weight: 3,
    startAt: '2026-10-01T09:00:00', dueAt: '2030-12-01T18:00:00', allocationPercent: 100,
    contributionDescription: '현재 수행 기록', contributionUpdatedAt: '2026-10-14T19:00:00', taskVersion: 2, deliverableSummary: [],
  }] }));
  const initialResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/spaces/1/manager-dashboard');
  await page.goto('/spaces/1/dashboard');
  const initial = await (await initialResponse).json();
  const detailResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/spaces/1/manager-dashboard' && new URL(response.url()).searchParams.has('teamId'));
  await page.getByRole('button', { name: '실제 API 팀 현황 보기', exact: true }).click();
  const detail = await (await detailResponse).json();
  await page.getByRole('button', { name: '← 팀 목록', exact: true }).click();
  const selectedTeam = { ...detail.teams[0], teamName: '힣 팀' };
  const teams = [
    ...Array.from({ length: 25 }, (_, index) => ({ ...selectedTeam, teamId: index + 2, teamName: `가 팀 ${String(index).padStart(2, '0')}`, members: undefined })),
    selectedTeam,
  ];
  await page.route('**/api/spaces/1/manager-dashboard*', (route) => route.fulfill({
    json: { ...initial, totalTeamCount: teams.length, teams: new URL(route.request().url()).searchParams.has('teamId') ? [selectedTeam] : teams },
  }));
  await page.getByRole('button', { name: '현황 새로고침', exact: true }).click();
  const table = page.getByRole('table', { name: '팀 관리', exact: true });
  await expect(table.locator('tbody > tr')).toHaveCount(26);
  await page.getByLabel('팀 정렬', { exact: true }).selectOption('progress');
  const teamLink = table.getByRole('button', { name: '힣 팀 현황 보기', exact: true });
  await teamLink.scrollIntoViewIfNeeded();
  const listScrollY = await page.evaluate(() => window.scrollY);
  expect(listScrollY).toBeGreaterThan(500);
  await teamLink.click();
  await page.getByRole('button', { name: '담당자 수행 상세', exact: true }).click();
  await page.getByRole('combobox', { name: '조회할 작업 상태', exact: true }).selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: '← 팀 관리', exact: true }).click();
  await page.getByRole('button', { name: '← 팀 목록', exact: true }).click();
  await expect(table.locator('tbody > tr')).toHaveCount(26);
  await expect(page.getByLabel('팀 정렬', { exact: true })).toHaveValue('progress');
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - listScrollY)).toBeLessThan(3);
});

test('OPEN 회차 일정 수정은 expectedVersion과 마감만 전송한다', async ({
  page,
}) => {
  const { requests } = await backend(page, { manager: true });
  await page.goto('/spaces/1/rounds');
  await page.getByRole('button', { name: '중간 평가 마감 시각 수정' }).click();
  await fillDateTime(
    page.getByRole('dialog'),
    '평가 마감 시각',
    '2030-12-02T18:00',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '저장', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    JSON.parse(requests.find((request) => request.method === 'PATCH').body),
  ).toEqual({ closesAt: '2030-12-02T18:00:00', expectedVersion: 3 });
});
test('AI 검토는 수동 요청 후 진행 상태를 조회하고 점수 없이 근거·질문을 표시한다', async ({
  page,
}) => {
  const { requests, setReview } = await backend(page);
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await expect(
    page.getByText('아직 요청한 AI 검토가 없습니다.', { exact: false }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.path.endsWith('ai-review') && request.method === 'POST',
    ),
  ).toBeFalsy();
  await page.getByRole('button', { name: 'AI 검토 요청', exact: true }).click();
  await expect(page.getByText('검토 대기', { exact: true })).toBeVisible();
  const post = requests.find(
    (request) =>
      request.path.endsWith('ai-review') && request.method === 'POST',
  );
  expect(post.body).toBeNull();
  expect(post.query).toBe('');
  expect(post.headers['x-csrf-token']).toBe('test-token');
  setReview({
    id: 1,
    taskId: 10,
    status: 'COMPLETED',
    isCurrent: false,
    summary: '실제 응답 검토 요약',
    strengths: [
      {
        message: '요구사항을 설명했습니다.',
        references: [
          {
            deliverableId: 40,
            quote: '확인할 원문',
            observation: null,
            location: '결과 절',
          },
        ],
      },
    ],
    improvements: [
      {
        type: 'QUESTION',
        issue: '누락된 조건을 확인했나요?',
        suggestion: '조건을 추가 확인해 주세요.',
        references: [],
      },
    ],
    limitations: ['외부 사실은 검증하지 않았습니다.'],
    failureCode: null,
    failureDeliverableId: null,
  });
  await page
    .getByRole('button', { name: '검토 상태 확인', exact: true })
    .click();
  await expect(page.getByText('실제 응답 검토 요약')).toBeVisible();
  await expect(page.getByText('확인할 원문', { exact: true })).toBeVisible();
  await expect(page.getByText('확인 질문', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/아래 결과는 현재 자료의 검토 결과가 아닙니다/),
  ).toBeVisible();
  expect(
    requests.filter(
      (request) =>
        request.path.endsWith('ai-review') && request.method === 'POST',
    ),
  ).toHaveLength(1);
  expect(
    requests.some(
      (request) =>
        request.path.includes('ai-evaluation') ||
        request.path.endsWith('/rework'),
    ),
  ).toBeFalsy();
});

test('AI 검토는 진행 중에만 조회하고 실패 결과 이후 반복 조회를 멈춘다', async ({
  page,
}) => {
  await page.clock.install();
  const { requests, setReview } = await backend(page);
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'AI 검토 요청', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('아직 요청한 AI 검토가 없습니다.', { exact: false }),
  ).toBeVisible();
  const initialReadCount = requests.filter((request) =>
    request.path.endsWith('/ai-review'),
  ).length;
  await page.clock.fastForward(30000);
  expect(
    requests.filter((request) => request.path.endsWith('/ai-review')),
  ).toHaveLength(initialReadCount);
  await page.getByRole('button', { name: 'AI 검토 요청', exact: true }).click();
  await expect(page.getByText('검토 대기', { exact: true })).toBeVisible();
  setReview({
    id: 1,
    taskId: 10,
    status: 'FAILED',
    isCurrent: true,
    summary: null,
    strengths: [],
    improvements: [],
    limitations: [],
    failureCode: 'DOCUMENT_UNREADABLE',
    failureDeliverableId: 40,
  });
  await page.clock.fastForward(5100);
  await expect(page.getByText('검토 실패', { exact: true })).toBeVisible();
  await expect(page.getByText(/실패 대상 산출물 #40/)).toBeVisible();
  const terminalRequestCount = requests.filter((request) =>
    request.path.endsWith('/ai-review'),
  ).length;
  await page.clock.fastForward(30000);
  expect(
    requests.filter((request) => request.path.endsWith('/ai-review')),
  ).toHaveLength(terminalRequestCount);
});

test('AI 상태 자동 재조회는 스페이스 목록을 유지하고 수동 목록 새로고침은 최신 오류를 전달한다', async ({
  page,
}) => {
  await page.clock.install();
  const { requests, setReview } = await backend(page);
  setReview({ id: 1, taskId: 10, status: 'PENDING', isCurrent: true });
  const initialSpaceRead = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/spaces',
  );
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await initialSpaceRead;
  await expect(page.getByText('검토 대기', { exact: true })).toBeVisible();
  const initialReviewReads = requests.filter((request) =>
    request.path.endsWith('/ai-review'),
  ).length;
  await page.route('**/api/spaces', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'SERVER_ERROR', message: '최신 스페이스 목록 조회 실패' },
    }),
  );
  await page.clock.fastForward(5100);
  await expect
    .poll(
      () =>
        requests.filter((request) => request.path.endsWith('/ai-review'))
          .length,
    )
    .toBeGreaterThan(initialReviewReads);
  await page
    .getByRole('complementary')
    .getByRole('button', { name: '내 스페이스', exact: true })
    .click();
  const list = page.getByRole('region', { name: '스페이스 목록', exact: true });
  await expect(list).toContainText('실제 API 스페이스');
  await page
    .getByRole('main')
    .getByRole('button', { name: '새로고침', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '최신 스페이스 목록 조회 실패',
  );
});

test('AI 비활성화·요청 제한 오류는 화면에 유지하고 자동으로 새 검토를 요청하지 않는다', async ({
  page,
}) => {
  await page.clock.install();
  const { requests } = await backend(page);
  let submissions = 0;
  await page.route('**/api/tasks/10/ai-review', (route) => {
    if (route.request().method() === 'GET') return route.fallback();
    submissions++;
    return route.fulfill({
      status: 503,
      json: {
        code: 'AI_REVIEW_UNAVAILABLE',
        message: 'AI 검토를 사용할 수 없습니다.',
      },
    });
  });
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await page.getByRole('button', { name: 'AI 검토 요청', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'AI 검토를 사용할 수 없습니다.',
  );
  await page.clock.fastForward(30000);
  expect(submissions).toBe(1);
  expect(
    requests.some((request) => request.path.includes('ai-evaluation')),
  ).toBeFalsy();
});

for (const width of [1440, 390]) {
  const type = 'MID', label = '중간 평가';
  test(`${width}px 미생성 회차도 중간·최종 구성을 표시하고 선택한 종류로만 생성한다`, async ({ page }) => {
    await backend(page, { manager: true });
    const rounds = [];
    const creationBodies = [];
    await page.route('**/api/spaces/1/evaluation-rounds', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        creationBodies.push(body);
        const created = { ...body, id: 20, spaceId: 1, status: 'DRAFT', version: 0, participantCount: 0 };
        rounds.push(created);
        return route.fulfill({ status: 201, json: created });
      }
      return route.fulfill({ json: rounds });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/spaces/1/rounds');
    const table = page.getByRole('table', { name: '중간·최종 평가 회차 운영 현황', exact: true });
    await expect(table.getByRole('rowheader')).toHaveText(['중간 평가', '최종 평가']);
    await expect(table.getByText('미설정', { exact: true })).toHaveCount(2);
    await expect(table.getByText('준비 중', { exact: true })).toHaveCount(0);
    await expect(table.getByRole('button', { name: '최종 평가 일정 설정', exact: true })).toBeDisabled();
    await expect(table.getByText('중간 평가 일정을 먼저 설정해 주세요.', { exact: true })).toBeVisible();
    expect(creationBodies).toEqual([]);
    await table.getByRole('button', { name: `${label} 일정 설정`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `${label} 일정 설정`, exact: true });
    await expect(dialog.getByLabel('평가 종류', { exact: true })).toHaveValue(type);
    await expect(dialog.getByLabel('평가 종류', { exact: true })).toBeDisabled();
    await fillDateTime(dialog, '평가 시작 시각', '2030-12-02T09:00');
    await fillDateTime(dialog, '평가 마감 시각', '2030-12-03T18:00');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(creationBodies).toEqual([{ type, opensAt: '2030-12-02T09:00:00', closesAt: '2030-12-03T18:00:00' }]);
    const createdRow = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
    await expect(createdRow.getByRole('button', { name: `${label} 일정 수정`, exact: true })).toBeVisible();
    await expect(createdRow.getByRole('button', { name: `${label} 시작`, exact: true })).toBeDisabled();
    await expect(table.getByText('미설정', { exact: true })).toHaveCount(1);
    await expect(table.getByRole('button', { name: '최종 평가 일정 설정', exact: true })).toBeEnabled();
    await page.reload();
    await expect(table.getByRole('rowheader')).toHaveText(['중간 평가', '최종 평가']);
    await expect(table.getByText('미설정', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('회차 조회 오류를 미설정 상태로 표시하지 않는다', async ({ page }) => {
  await backend(page, { manager: true });
  await page.route('**/api/spaces/1/evaluation-rounds', (route) => route.fulfill({ status: 503, json: { message: '회차를 불러올 수 없습니다.' } }));
  await page.goto('/spaces/1/rounds');
  await expect(page.getByRole('alert')).toContainText('회차를 불러올 수 없습니다.');
  await expect(page.getByRole('button', { name: /평가 일정 설정/ })).toHaveCount(0);
  await expect(page.getByText('미설정', { exact: true })).toHaveCount(0);
});

test('회차 생성과 개방은 실제 POST를 사용하고 팀 구성 변경을 다시 조회한다', async ({
  page,
}) => {
  const { requests } = await backend(page, {
    manager: true,
    roundStatus: 'DRAFT',
  });
  await page.goto('/spaces/1/rounds');
  const table = page.getByRole('table', { name: '중간·최종 평가 회차 운영 현황', exact: true });
  await expect(table.getByRole('rowheader')).toHaveText(['중간 평가', '최종 평가']);
  await expect(table.getByText('미설정', { exact: true })).toHaveCount(1);
  await page
    .getByRole('button', { name: '중간 평가 시작', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '중간 평가 마감 시각 수정' }),
  ).toBeVisible();
  const open = requests.find((request) => request.path.endsWith('/open'));
  expect(open.method).toBe('POST');
  expect(open.body).toBeNull();
  expect(
    requests.filter((request) => request.path === '/api/spaces/1').length,
  ).toBeGreaterThan(1);
  await page
    .getByRole('button', { name: '최종 평가 일정 설정', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await fillDateTime(dialog, '평가 시작 시각', '2030-12-02T09:00');
  await fillDateTime(dialog, '평가 마감 시각', '2030-12-03T18:00');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    JSON.parse(
      requests.find(
        (request) =>
          request.path === '/api/spaces/1/evaluation-rounds' &&
          request.method === 'POST',
      ).body,
    ),
  ).toEqual({
    type: 'FINAL',
    opensAt: '2030-12-02T09:00:00',
    closesAt: '2030-12-03T18:00:00',
  });
});

test('FINAL 마감 후 새 AI 검토 버튼을 숨기고 기존 피드백은 읽을 수 있다', async ({
  page,
}) => {
  const { requests, setTask, setReview } = await backend(page);
  setTask({ completionBlockReason: 'WORK_PERIOD_CLOSED' });
  setReview({
    id: 1,
    taskId: 10,
    status: 'COMPLETED',
    isCurrent: true,
    summary: '마감 후에도 확인할 기존 피드백',
    strengths: [],
    improvements: [],
    limitations: [],
    failureCode: null,
    failureDeliverableId: null,
  });
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await expect(page.getByText('마감 후에도 확인할 기존 피드백')).toBeVisible();
  await expect(
    page.getByText(/최종 평가 마감 이후에는 새 검토를 요청할 수 없습니다/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'AI 검토 요청', exact: true }),
  ).toHaveCount(0);
  expect(
    requests.some(
      (request) =>
        request.path.endsWith('/ai-review') && request.method === 'POST',
    ),
  ).toBeFalsy();
});

test('AI 조회의 권한 오류에서는 폴링과 새 검토 요청을 제공하지 않는다', async ({
  page,
}) => {
  await page.clock.install();
  await backend(page);
  let reads = 0;
  await page.route('**/api/tasks/10/ai-review', (route) => {
    reads++;
    return route.fulfill({
      status: 403,
      json: { code: 'FORBIDDEN', message: '검토 조회 권한이 없습니다.' },
    });
  });
  await page.goto('/spaces/1/teams/1/tasks/10');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '검토 조회 권한이 없습니다.',
  );
  const initialReads = reads;
  await page.clock.fastForward(30000);
  expect(reads).toBe(initialReads);
  await expect(
    page.getByRole('button', { name: 'AI 검토 요청', exact: true }),
  ).toHaveCount(0);
});

const defaultWeights = { taskPercent: 70, midPercent: 10, finalPercent: 20 };
const contributionDetails = (percent, weights = defaultWeights) => ({
  taskRatioPercent: percent,
  midRatioPercent: percent,
  finalRatioPercent: percent,
  taskContributionPercent: percent * weights.taskPercent / 100,
  midContributionPercent: percent * weights.midPercent / 100,
  finalContributionPercent: percent * weights.finalPercent / 100,
  roundingAdjustmentPercent: 0,
  totalPercent: percent,
});
function reportResponse(manager, status = 'UNPUBLISHED', weights = defaultWeights) {
  return {
    id: 40,
    teamId: 1,
    status,
    cutoffAt: '2026-10-14T19:00:00',
    createdAt: '2026-10-15T19:00:00',
    publishedAt: status === 'PUBLISHED' ? '2026-10-15T20:00:00' : null,
    totalPercent: 100,
    weights,
    members: members.map((member, index) => ({
      userId: member.userId,
      name: member.name,
      contributionPercent: index ? 40 : 60,
      ...(manager ? { details: contributionDetails(index ? 40 : 60, weights) } : {}),
    })),
    myDetails: manager ? null : contributionDetails(60, weights),
  };
}
async function reportBackend(
  page,
  {
    manager = true,
    initialReport = null,
    generateError = null,
    publishError = null,
    getError = null,
  } = {},
) {
  const fixture = await backend(page, {
    manager,
    roundStatus: 'CLOSED',
    reportReady: true,
  });
  let report = initialReport;
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname === '/api/spaces/1') return route.fulfill({ json: { id: 1, name: '실제 API 스페이스', myRole: manager ? 'MANAGER' : 'USER', version: 1, teamBuildingStatus: 'CLOSED', teamBuildingOpensAt: '2026-01-01T09:00:00', teamBuildingClosesAt: '2026-01-02T09:00:00', reportWeights: report?.weights ?? null } });
    if (url.pathname === '/api/spaces/1/manager-dashboard') {
      return route.fulfill({ json: {
        spaceId: 1, totalTeamCount: 1,
        teams: [{ teamId: 1, teamName: '실제 API 팀', approvedMemberCount: 2, reportId: report?.id ?? null, reportStatus: report?.status ?? null }],
        missingPeerSubmissions: ['MID', 'FINAL'].map((type, index) => ({
          roundId: 11 + index, type, status: 'CLOSED', requiredCount: 2, submittedCount: 2, missingCount: 0,
          teams: [{ teamId: 1, requiredCount: 2, submittedCount: 2, missingCount: 0 }],
        })),
      } });
    }
    if (
      !['/api/teams/1/report', '/api/reports/40/publish'].includes(url.pathname)
    )
      return route.fallback();
    fixture.requests.push({
      path: url.pathname,
      method: request.method(),
      query: url.search,
      body: request.postData(),
      headers: request.headers(),
    });
    const error = url.pathname.endsWith('/publish')
      ? publishError
      : request.method() === 'POST'
        ? generateError
        : getError;
    if (error)
      return route.fulfill({
        status: error.status || 409,
        json: { code: error.code, message: error.message || '서버 거절' },
      });
    if (url.pathname.endsWith('/publish'))
      report = {
        ...report,
        status: 'PUBLISHED',
        publishedAt: '2026-10-15T20:00:00',
      };
    else if (request.method() === 'POST') report ||= reportResponse(manager, 'UNPUBLISHED', request.postDataJSON() ?? defaultWeights);
    return route.fulfill({ json: report });
  });
  return fixture;
}

test('전체 리포트를 생성하고 결과를 확인한 뒤 별도로 공개한다', async ({
  page,
}) => {
  const fixture = await reportBackend(page);
  await page.goto('/spaces/1/reports');
  await expect(page.getByRole('list', { name: '리포트 진행 단계', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '팀원에게 공개', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '전체 리포트 생성', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.locator('.report-publication-status')).toHaveText('미공개');
  await expect(page.getByRole('button', { name: '전체 리포트 생성', exact: true })).toHaveCount(0);
  expect(fixture.requests.some((request) => request.path.endsWith('/publish'))).toBe(false);
  await page.reload();
  await expect(page.locator('.report-publication-status')).toHaveText('미공개');
  await page.getByRole('button', { name: '담당자 계산 근거 보기', exact: true }).click();
  await page.getByText('담당자님의 계산 근거 보기', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '담당자님의 계산 근거' }),
  ).toBeVisible();
  await page.getByRole('dialog', { name: '담당자님의 기여도 상세' }).getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '리더 계산 근거 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '담당자님의 계산 근거' })).toHaveCount(0);
  await page.getByText('리더님의 계산 근거 보기', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '리더님의 계산 근거' }),
  ).toBeVisible();
  await page.getByRole('dialog', { name: '리더님의 기여도 상세' }).press('Escape');
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
  await expect(page.getByText('AI 작업 평가', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '팀원에게 공개', exact: true }).click();
  await page.getByRole('dialog', { name: '기여도 리포트 공개', exact: true }).getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.report-publication-status')).toHaveText('미공개');
  expect(fixture.requests.some((request) => request.path.endsWith('/publish'))).toBe(false);
  await page.getByRole('button', { name: '팀원에게 공개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '공개 확정' })
    .click();
  await expect(
    page.locator('.report-metadata > .status-badge'),
  ).toHaveText('공개 완료');
  for (const path of ['/api/teams/1/report', '/api/reports/40/publish']) {
    const request = fixture.requests.find(
      (request) => request.path === path && request.method === 'POST',
    );
    expect(request.body).toBe(path === '/api/teams/1/report' ? JSON.stringify(defaultWeights) : null);
    expect(request.query).toBe('');
    expect(request.headers['x-csrf-token']).toBe('test-token');
  }
  await page.reload();
  await expect(
    page.locator('.report-metadata > .status-badge'),
  ).toHaveText('공개 완료');
  await expect(
    page.getByRole('button', { name: '팀원에게 공개', exact: true }),
  ).toHaveCount(0);
});

test('팀원은 공개 결과와 본인 근거만 보고 관리 API를 호출하지 않는다', async ({
  page,
}) => {
  const fixture = await reportBackend(page, {
    manager: false,
    initialReport: reportResponse(false, 'PUBLISHED'),
  });
  await page.goto('/spaces/1/teams/1/reports');
  await page.getByText('나의 계산 근거 보기', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '나의 계산 근거' }),
  ).toBeVisible();
  await expect(page.getByRole('rowheader', { name: '완료 작업', exact: true })).toBeVisible();
  await expect(page.getByText('리더님의 계산 근거 보기')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '동료 평가 결과', exact: true }),
  ).toHaveCount(0);
  expect(
    fixture.requests.some(
      (request) =>
        request.path.endsWith('/manager-dashboard') ||
        /teams\/1\/responses$/.test(request.path),
    ),
  ).toBe(false);
});

test('리포트의 작업 반영분 0을 누락 값으로 취급하거나 다른 수치로 대체하지 않는다', async ({ page }) => {
  const report = reportResponse(false, 'PUBLISHED');
  report.myDetails = {
    ...contributionDetails(60),
    taskRatioPercent: 0,
    taskContributionPercent: 0,
    totalPercent: 18,
  };
  report.members[0].contributionPercent = 18;
  report.members[1].contributionPercent = 82;
  await reportBackend(page, { manager: false, initialReport: report });
  await page.goto('/spaces/1/teams/1/reports');
  const summary = page.getByRole('region', { name: '나의 기여율 요약', exact: true });
  await expect(summary.locator('.report-score-total > strong')).toHaveText('18.0%');
  await expect(summary.locator('dd').first()).toContainText('0.0%p');
  await summary.getByRole('button', { name: '완료 작업 반영분 설명' }).focus();
  await expect(summary.getByRole('tooltip')).toContainText('0.0% × 반영 비중 70% = 0.0%p');
  await expect(page.getByRole('button', { name: /계산 근거 보기/ })).toHaveCount(0);
});

test('미공개 리포트 null과 실제 404를 구분하고 오류를 목업으로 바꾸지 않는다', async ({
  page,
}) => {
  await reportBackend(page, { manager: false });
  await page.goto('/spaces/1/teams/1/reports');
  await expect(
    page.getByRole('heading', { name: '공개된 리포트가 없습니다.' }),
  ).toBeVisible();
  await page.route('**/api/teams/1/report', (route) =>
    route.fulfill({
      status: 404,
      json: { code: 'TEAM_NOT_FOUND', message: '조회 대상 팀이 없습니다.' },
    }),
  );
  await page.getByRole('button', { name: '리포트 새로고침' }).click();
  await expect(page.getByRole('alert')).toContainText(
    '조회 대상 팀이 없습니다.',
  );
  await expect(
    page.getByRole('heading', { name: '공개된 리포트가 없습니다.' }),
  ).toHaveCount(0);
  await expect(page.getByText('팀 기여도 리포트', { exact: true })).toHaveCount(
    0,
  );
});

test('표시상 마감 후에도 서버 마감 정리와 완료 작업 부족 오류를 안내한다', async ({
  page,
}) => {
  const fixture = await reportBackend(page, {
    generateError: { code: 'REPORT_INPUT_INCOMPLETE' },
  });
  await page.goto('/spaces/1/reports');
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('서버의 마감 정리');
  await expect(
    page.getByRole('list', { name: '회차별 리포트 준비 상태' }),
  ).toBeVisible();
  expect(
    fixture.requests.filter(
      (request) =>
        request.path === '/api/teams/1/report' && request.method === 'POST',
    ),
  ).toHaveLength(1);
  await page.route('**/api/teams/1/report', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          json: { code: 'REPORT_UNCALCULABLE', message: '계산 불가' },
        })
      : route.fallback(),
  );
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '완료 작업 또는 평가 입력이 부족',
  );
});

test('리포트 공개 실패는 비공개 결과를 유지하고 자동 재요청하지 않는다', async ({
  page,
}) => {
  const fixture = await reportBackend(page, {
    initialReport: reportResponse(true),
    publishError: { code: 'REPORT_PUBLICATION_BLOCKED' },
  });
  await page.goto('/spaces/1/reports');
  await page.getByRole('button', { name: '팀원에게 공개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '공개 확정' })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '해당 팀의 두 회차 마감',
  );
  await expect(
    page.locator('.report-metadata > .status-badge'),
  ).toHaveText('미공개');
  expect(
    fixture.requests.filter((request) => request.path.endsWith('/publish')),
  ).toHaveLength(1);
});

test('관리자는 부분 제출된 평가 원문을 읽고 OPEN 회차 원문은 호출하지 않는다', async ({
  page,
}) => {
  const fixture = await backend(page, {
    manager: true,
    roundStatus: 'CLOSED',
    reportReady: true,
  });
  fixture.rounds[1].status = 'OPEN';
  await page.route('**/api/evaluation-rounds/11/teams/1/responses', (route) =>
    route.fulfill({
      json: {
        roundId: 11,
        type: 'MID',
        teamId: 1,
        requiredCount: 2,
        submittedCount: 1,
        missingCount: 1,
        responses: [
          {
            evaluatorId: members[0].userId,
            evaluatorName: '평가 작성자',
            targetId: members[1].userId,
            targetName: '평가 대상자',
            scores: {
              taskExecution: 4,
              responsibility: 3,
              collaboration: 2,
              communication: 5,
            },
            reason: '관리자 전용 제출 사유입니다.',
            submittedAt: '2026-10-15T19:00:00',
          },
        ],
      },
    }),
  );
  await page.goto('/spaces/1/rounds');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await expect(
    page.getByRole('heading', { name: '동료 평가 관리', exact: true }),
  ).toBeVisible();
  expect(
    fixture.requests.some((request) =>
      /teams\/1\/responses$/.test(request.path),
    ),
  ).toBe(false);
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
  await expect(panel.getByRole('heading', { name: '평가 대상자님이 받은 평가', exact: true })).toBeVisible();
  await expect(panel.getByRole('rowheader', { name: '평가 작성자', exact: true })).toBeVisible();
  await expect(panel.getByText('관리자 전용 제출 사유입니다.')).toBeVisible();
  await expect(panel.getByRole('group', { name: '평가 제출 현황' })).toContainText('1명');
  await panel.getByRole('combobox', { name: '결과 조회 회차', exact: true }).selectOption('12');
  await expect(panel).toContainText('회차 마감 후 최종 제출된 평가를 조회');
  await expect(panel.getByText('관리자 전용 제출 사유입니다.')).toHaveCount(0);
  expect(
    fixture.requests.some(
      (request) =>
        request.path === '/api/evaluation-rounds/12/teams/1/responses',
    ),
  ).toBe(false);
});

test('관리자 평가 원문은 마감 정리 대기를 안내하고 권한 오류 후 원문을 숨긴다', async ({
  page,
}) => {
  await backend(page, { manager: true, roundStatus: 'CLOSED' });
  let forbidden = false;
  await page.route('**/api/evaluation-rounds/11/teams/1/responses', (route) =>
    route.fulfill({
      status: forbidden ? 403 : 409,
      json: {
        code: forbidden ? 'FORBIDDEN' : 'ROUND_NOT_CLOSED',
        message: '관리자 권한이 없습니다.',
      },
    }),
  );
  await page.goto('/spaces/1/rounds?teamId=1&tab=peer-responses');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await expect(panel).toContainText('마감 정리가 아직 끝나지 않았습니다.');
  forbidden = true;
  await panel.getByRole('button', { name: '평가 결과 새로고침' }).click();
  await expect(panel.getByRole('alert')).toContainText(
    '관리자 권한이 없습니다.',
  );
});

test('대시보드 서버 리포트 상태에서 검토 화면으로 진입한다', async ({
  page,
}) => {
  await backend(page, {
    manager: true,
    reportId: 40,
    reportStatus: 'PUBLISHED',
  });
  await page.goto('/spaces/1/dashboard');
  const table = page.locator('.desktop-data-table').first();
  await expect(table).toContainText('공개');
  await table.getByRole('button', { name: '리포트 검토 화면' }).click();
  await expect(page).toHaveURL(/\/spaces\/1\/reports\?teamId=1$/);
});

test('관리자 수행 상세는 요약과 별도 현재 산출물 본문·파일을 실제 API로 읽는다', async ({
  page,
}) => {
  const fixture = await backend(page, { manager: true });
  await page.route('**/api/teams/1/members/*/contributions', (route) =>
    route.fulfill({
      json: [
        {
          taskId: 10,
          title: '서버 담당 작업',
          status: 'DONE',
          weight: 3,
          startAt: '2026-10-01T09:00:00',
          dueAt: '2026-10-14T19:00:00',
          allocationPercent: 60,
          contributionDescription: '서버에 저장한 수행 설명',
          contributionUpdatedAt: '2026-10-14T19:00:00',
          taskVersion: 2,
          deliverableSummary: [
            {
              id: 90,
              title: '현재 결과 문서',
              category: 'OTHER',
              type: 'TEXT',
              version: 1,
            },
            {
              id: 91,
              title: '최종 파일',
              category: 'OTHER',
              type: 'FILE',
              version: 1,
            },
          ],
        },
      ],
    }),
  );
  const deliverableCalls = [];
  await page.route('**/api/teams/1/deliverables?*', (route) => {
    deliverableCalls.push(new URL(route.request().url()).searchParams);
    return route.fulfill({
      json: [
        {
          id: 90,
          title: '현재 결과 문서',
          version: 1,
          type: 'TEXT',
          text: '별도 목록 API의 실제 현재 본문',
        },
        {
          id: 91,
          title: '최종 파일',
          version: 2,
          type: 'FILE',
          file: {
            originalFilename: '결과.txt',
            sizeBytes: 6,
            contentType: 'text/plain',
          },
        },
      ],
    });
  });
  await page.route('**/api/deliverables/91/file', (route) =>
    route.fulfill({ contentType: 'text/plain', body: 'real file bytes' }),
  );
  await page.goto(`/spaces/1/manager/teams/1/members/${members[0].userId}`);
  await expect(
    page.getByText('서버에 저장한 수행 설명', { exact: true }),
  ).toBeVisible();
  await page.getByText('현재 결과 문서 · 문서', { exact: true }).click();
  await expect(page.getByText('별도 목록 API의 실제 현재 본문')).toBeVisible();
  await page.getByText('최종 파일 · 파일', { exact: true }).click();
  await expect(
    page.getByText('요약 조회 이후 변경된 최신 산출물입니다.'),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '파일 다운로드' }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe('결과.txt');
  expect(await readFile(await downloaded.path(), 'utf8')).toBe(
    'real file bytes',
  );
  expect(
    deliverableCalls.every(
      (query) => query.get('taskId') === '10' && query.get('size') === '100',
    ),
  ).toBe(true);
  expect(
    fixture.requests.filter((request) => request.method !== 'GET'),
  ).toEqual([]);
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
});

test('평가 미마감 상태에서는 리포트 생성을 막는다', async ({ page }) => {
  const fixture = await backend(page, { manager: true });
  await page.route('**/api/teams/1/report', (route) =>
    route.fulfill({ json: null }),
  );
  await page.goto('/spaces/1/reports');
  await expect(
    page.getByRole('button', { name: '전체 리포트 생성', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('list', { name: '회차별 리포트 준비 상태' }),
  ).toBeVisible();
  expect(fixture.requests.some((request) => request.method === 'POST')).toBe(
    false,
  );
});

for (const [status, code, message] of [
  [403, 'FORBIDDEN', '스페이스 관리자만 조회할 수 있습니다.'],
  [404, 'TEAM_MEMBER_NOT_FOUND', '대상 팀원이 없습니다.'],
]) {
  test(`수행 상세 ${status} 오류를 예시 작업이나 빈 목록으로 바꾸지 않는다`, async ({
    page,
  }) => {
    await backend(page, { manager: true });
    await page.route('**/api/teams/1/members/*/contributions', (route) =>
      route.fulfill({ status, json: { code, message } }),
    );
    await page.goto(`/spaces/1/manager/teams/1/members/${members[0].userId}`);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(
      page.getByText('현재 담당 작업이 없습니다.', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '담당 작업 요약' }),
    ).toHaveCount(0);
  });
}

test('관리자 원문 회차 새로고침으로 마감된 회차를 조회한다', async ({
  page,
}) => {
  const fixture = await backend(page, { manager: true });
  await page.goto('/spaces/1/rounds?teamId=1&tab=peer-responses');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await expect(panel).toContainText('회차 마감 후 최종 제출된 평가를 조회');
  fixture.rounds[0].status = 'CLOSED';
  await panel.getByRole('button', { name: '평가 결과 새로고침' }).click();
  await expect(
    panel.getByText('최종 제출된 평가 응답이 없습니다.', { exact: true }),
  ).toBeVisible();
  expect(
    fixture.requests.some(
      (request) =>
        request.path === '/api/evaluation-rounds/11/teams/1/responses',
    ),
  ).toBe(true);
});

test('관리자 목록 정렬은 지연 건수와 실제 진행률을 사용하며 작업 없는 팀을 0%로 취급하지 않는다', async ({
  page,
}) => {
  const { requests } = await backend(page, { manager: true });
  const teamOverview = {
    leaderName: '리더',
    approvedMemberCount: 2,
    hasMinimumMembers: true,
    pendingApplications: 0,
    totalTaskCount: 4,
    todoTaskCount: 1,
    inProgressTaskCount: 2,
    revisingTaskCount: 0,
    doneTaskCount: 1,
    completionRate: 25,
    overdueTaskCount: 0,
    staleTaskCount: 0,
    deliverableCount: 1,
    reportId: null,
    reportStatus: null,
  };
  await page.route('**/api/spaces/1/manager-dashboard*', (route) =>
    route.fulfill({
      json: {
        spaceId: 1,
        spaceName: '실제 API 스페이스',
        teamId: null,
        asOf: '2026-10-14T19:00:00',
        totalTeamCount: 3,
        unassignedCount: 0,
        pendingApplications: 0,
        overdueTaskCount: 4,
        staleTaskCount: 0,
        revisingTaskCount: 0,
        teams: [
          {
            ...teamOverview,
            teamId: 1,
            teamName: '가 팀',
            completionRate: 0,
            doneTaskCount: 0,
            overdueTaskCount: 1,
          },
          {
            ...teamOverview,
            teamId: 2,
            teamName: '나 팀',
            completionRate: 75,
            doneTaskCount: 3,
            overdueTaskCount: 3,
          },
          {
            ...teamOverview,
            teamId: 3,
            teamName: '다 팀',
            completionRate: null,
            totalTaskCount: 0,
            todoTaskCount: 0,
            inProgressTaskCount: 0,
            doneTaskCount: 0,
          },
        ],
        missingPeerSubmissions: [
          {
            roundId: 11,
            type: 'MID',
            status: 'DRAFT',
            requiredCount: 0,
            submittedCount: 0,
            missingCount: 0,
          },
          {
            roundId: 12,
            type: 'FINAL',
            status: 'OPEN',
            requiredCount: 6,
            submittedCount: 2,
            missingCount: 4,
          },
        ],
      },
    }),
  );
  await page.goto('/spaces/1/dashboard');
  const table = page.getByRole('table', {
    name: '팀 관리',
    exact: true,
  });
  const names = table.getByRole('rowheader');
  await page.getByLabel('팀 정렬', { exact: true }).selectOption('overdue');
  await expect(names).toHaveText([/나 팀/, /가 팀/, /다 팀/]);
  await page.getByLabel('팀 정렬', { exact: true }).selectOption('progress');
  await expect(names).toHaveText([/가 팀/, /나 팀/, /다 팀/]);
  const emptyTeam = table.getByRole('row').filter({ hasText: '다 팀' });
  await expect(emptyTeam.getByText('작업 없음', { exact: true })).toBeVisible();
  await expect(emptyTeam.getByRole('progressbar')).toHaveCount(0);
  await expect(
    table.getByRole('progressbar', {
      name: '가 팀 팀 전체 진행률',
      exact: true,
    }),
  ).toHaveAttribute('aria-valuenow', '0');
  expect(requests.some((request) => request.path.endsWith('/responses'))).toBe(
    false,
  );
});

test('수행 상세는 대상 팀원의 중간·최종 수신 평균을 구분하고 개선 피드백을 조회하지 않는다', async ({
  page,
}) => {
  const fixture = await backend(page, {
    manager: true,
    roundStatus: 'CLOSED',
    reportReady: true,
  });
  const response = (targetId, evaluatorId, scores) => ({
    targetId,
    targetName: '평가 대상자',
    evaluatorId,
    evaluatorName: '평가자',
    scores,
    reason: '상세에 노출하지 않을 평가 사유',
    submittedAt: '2026-10-15T19:00:00',
  });
  await page.route('**/api/evaluation-rounds/*/teams/1/responses', (route) => {
    const isMid = route.request().url().includes('/11/');
    return route.fulfill({
      json: {
        roundId: isMid ? 11 : 12,
        type: isMid ? 'MID' : 'FINAL',
        teamId: 1,
        requiredCount: 3,
        submittedCount: isMid ? 2 : 3,
        missingCount: isMid ? 1 : 0,
        responses: isMid
          ? [
              response(members[0].userId, members[1].userId, {
                taskExecution: 4,
                responsibility: 3,
                collaboration: 2,
                communication: 5,
              }),
              response(
                members[0].userId,
                '00000000-0000-4000-8000-000000000003',
                {
                  taskExecution: 5,
                  responsibility: 4,
                  collaboration: 3,
                  communication: 4,
                },
              ),
              response(members[1].userId, members[0].userId, {
                taskExecution: 1,
                responsibility: 1,
                collaboration: 1,
                communication: 1,
              }),
            ]
          : [
              response(members[0].userId, members[1].userId, {
                taskExecution: 2,
                responsibility: 3,
                collaboration: 4,
                communication: 5,
              }),
            ],
      },
    });
  });
  await page.goto(`/spaces/1/manager/teams/1/members/${members[0].userId}`);
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
  const mid = page.getByRole('region', { name: '중간 평가 결과', exact: true });
  const final = page.getByRole('region', {
    name: '최종 평가 결과',
    exact: true,
  });
  await expect(mid.getByRole('definition')).toHaveText([
    '4.50 / 5',
    '3.50 / 5',
    '2.50 / 5',
    '4.50 / 5',
  ]);
  await expect(final.getByRole('definition')).toHaveText([
    '2.00 / 5',
    '3.00 / 5',
    '4.00 / 5',
    '5.00 / 5',
  ]);
  await expect(mid).toContainText('수신 평가 2건');
  await expect(mid).toContainText('팀 전체 미제출 1명');
  await expect(
    page.getByText('상세에 노출하지 않을 평가 사유', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', {
      name: /개선 안내|중간 피드백|다음 작업에서 확인할 점/,
    }),
  ).toHaveCount(0);
  expect(
    fixture.requests.some((request) => request.path.endsWith('/mid-feedback')),
  ).toBe(false);
});

for (const roundStatus of ['DRAFT', 'OPEN']) {
  test(`수행 상세의 ${roundStatus} 회차는 점수를 조회하지 않고 미설정 최종 회차와 구분한다`, async ({
    page,
  }) => {
    const fixture = await backend(page, { manager: true, roundStatus });
    await page.goto(`/spaces/1/manager/teams/1/members/${members[0].userId}`);
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
    await expect(
      page.getByRole('region', { name: '중간 평가 결과', exact: true }),
    ).toContainText('회차 마감 후 결과를 확인할 수 있습니다.');
    await expect(
      page.getByRole('region', { name: '최종 평가 결과', exact: true }),
    ).toContainText('아직 평가 회차가 생성되지 않았습니다.');
    expect(
      fixture.requests.some((request) =>
        /teams\/1\/responses$|mid-feedback$/.test(request.path),
      ),
    ).toBe(false);
  });
}

test('수행 상세는 수신 평가 없음·마감 정리 대기·권한 오류를 점수 0으로 대체하지 않는다', async ({
  page,
}) => {
  await backend(page, {
    manager: true,
    roundStatus: 'CLOSED',
    reportReady: true,
  });
  let responseState = 'waiting';
  await page.route('**/api/evaluation-rounds/11/teams/1/responses', (route) =>
    responseState === 'waiting'
      ? route.fulfill({ status: 409, json: { code: 'ROUND_NOT_CLOSED' } })
      : responseState === 'forbidden'
        ? route.fulfill({
            status: 403,
            json: {
              code: 'FORBIDDEN',
              message: '스페이스 관리자 권한이 없습니다.',
            },
          })
        : route.fulfill({
            json: {
              roundId: 11,
              type: 'MID',
              teamId: 1,
              requiredCount: 2,
              submittedCount: 1,
              missingCount: 1,
              responses: [
                {
                  targetId: members[0].userId,
                  scores: {
                    taskExecution: 4,
                    responsibility: 4,
                    collaboration: 4,
                    communication: 4,
                  },
                },
              ],
            },
          }),
  );
  await page.goto(`/spaces/1/manager/teams/1/members/${members[0].userId}`);
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
  const mid = page.getByRole('region', { name: '중간 평가 결과', exact: true });
  const final = page.getByRole('region', {
    name: '최종 평가 결과',
    exact: true,
  });
  await expect(mid).toContainText('마감 정리가 아직 끝나지 않았습니다.');
  await expect(final).toContainText('이 팀원에게 최종 제출된 평가가 없습니다.');
  await expect(final.getByRole('definition')).toHaveCount(0);
  responseState = 'ready';
  await mid
    .getByRole('button', { name: '평가 결과 다시 불러오기', exact: true })
    .click();
  await expect(mid.getByRole('definition')).toHaveText([
    '4.00 / 5',
    '4.00 / 5',
    '4.00 / 5',
    '4.00 / 5',
  ]);
  responseState = 'forbidden';
  await page
    .getByRole('button', { name: '수행 상세 새로고침', exact: true })
    .click();
  await expect(mid.getByRole('alert')).toContainText(
    '스페이스 관리자 권한이 없습니다.',
  );
  await expect(mid.getByRole('definition')).toHaveCount(0);
  await expect(final).toContainText('이 팀원에게 최종 제출된 평가가 없습니다.');
});


test('관리자 작업 조회는 서버 권한 오류를 유지하고 허용 응답에서 변경 기능 없이 상세를 조회한다', async ({ page }) => {
  const fixture = await backend(page, { manager: true });
  let denied = true;
  await page.route('**/api/teams/1/tasks', (route) => denied
    ? route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: '작업 조회 권한이 없습니다.' } })
    : route.fallback());
  await page.goto('/spaces/1/dashboard?teamId=1');
  await page.getByRole('navigation', { name: '팀 조회 바로가기' }).getByRole('button', { name: '작업 보기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('작업 조회 권한이 없습니다.');
  await expect(page.getByRole('button', { name: '현재 작업', exact: true })).toHaveCount(0);
  denied = false;
  await page.reload();
  await page.getByRole('group', { name: '작업 보기 방식' }).getByRole('button', { name: '목록', exact: true }).click();
  await page.getByRole('button', { name: '현재 작업', exact: true }).click();
  await expect(page.getByRole('heading', { name: '현재 작업', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '수행설명', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  for (const label of ['새 작업 만들기', '작업 수정', '작업 삭제', '완료 처리', '수행 설명 저장'])
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  expect(fixture.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
  expect(fixture.requests.some((request) => /comments|ai-review/.test(request.path))).toBe(false);
});


test('리포트 관리는 이전 결과 탭 주소에서도 생성·공개만 제공하고 동료 평가 원문을 요청하지 않는다', async ({ page }) => {
  const fixture = await reportBackend(page, { initialReport: reportResponse(true) });
  await page.goto('/spaces/1/reports?teamId=1&tab=peer-responses&peerRoundId=11');
  await expect(page.getByRole('heading', { name: '리포트 관리', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '팀원에게 공개', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '팀 최종 기여율', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '리포트 새로고침', exact: true }).click();
  await expect(page.getByRole('region', { name: '팀 최종 기여율', exact: true })).toBeVisible();
  expect(fixture.requests.some((request) => /teams\/1\/responses$/.test(request.path))).toBe(false);
});

async function batchReportBackend(page, { missing = false, open = false, failSecondOnce = false, lockedWeights = null } = {}) {
  await reportBackend(page);
  const reports = new Map();
  const generatedTeams = [];
  const generationWeights = [];
  const teams = [1, 2].map((id) => ({ id, spaceId: 1, name: `테스트 ${id}팀`, approvedMemberCount: 2 }));
  await page.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/spaces/1') return route.fulfill({ json: { id: 1, name: '실제 API 스페이스', myRole: 'MANAGER', version: 1, teamBuildingStatus: 'CLOSED', reportWeights: lockedWeights } });
    if (path === '/api/spaces/1/teams') return route.fulfill({ json: teams });
    if (path === '/api/teams/2') return route.fulfill({ json: teams[1] });
    if (path === '/api/spaces/1/evaluation-rounds') return route.fulfill({ json: ['MID', 'FINAL'].map((type, index) => ({ id: 11 + index, type, status: open && type === 'FINAL' ? 'OPEN' : 'CLOSED' })) });
    if (path === '/api/spaces/1/manager-dashboard') return route.fulfill({ json: {
      totalTeamCount: 2,
      teams: teams.map((team) => ({ teamId: team.id, teamName: team.name, approvedMemberCount: 2, reportId: reports.get(team.id)?.id ?? null })),
      missingPeerSubmissions: ['MID', 'FINAL'].map((type, index) => ({ roundId: 11 + index, type, missingCount: missing ? 1 : 0,
        teams: teams.map((team) => ({ teamId: team.id, requiredCount: 2, submittedCount: missing && team.id === 2 ? 1 : 2, missingCount: missing && team.id === 2 ? 1 : 0 })),
      })),
    } });
    const match = path.match(/^\/api\/teams\/(\d+)\/report$/);
    if (!match) return route.fallback();
    const teamId = Number(match[1]);
    if (request.method() === 'POST') {
      generatedTeams.push(teamId);
      const weights = request.postDataJSON();
      generationWeights.push(weights);
      if (teamId === 2 && failSecondOnce) {
        failSecondOnce = false;
        return route.fulfill({ status: 409, json: { code: 'REPORT_UNCALCULABLE', message: '계산 불가' } });
      }
      lockedWeights ??= weights;
      reports.set(teamId, { ...reportResponse(true, 'UNPUBLISHED', weights), id: 40 + teamId, teamId });
    }
    return route.fulfill({ json: reports.get(teamId) ?? null });
  });
  return { reports, generatedTeams, generationWeights, setLockedWeights: (value) => { lockedWeights = value; }, setMissing: (value) => { missing = value; }, setOpen: (value) => { open = value; } };
}

test('전체 팀의 필수 제출과 두 회차 마감이 모두 완료돼야 일괄 생성할 수 있다', async ({ page }) => {
  const fixture = await batchReportBackend(page, { missing: true });
  await page.goto('/spaces/1/reports');
  const generate = page.getByRole('button', { name: '전체 리포트 생성', exact: true });
  await expect(generate).toBeDisabled();
  await expect(page.getByRole('list', { name: '회차별 리포트 준비 상태' })).toContainText('1/2팀 제출 완료');
  fixture.setMissing(false);
  fixture.setOpen(true);
  await page.getByRole('button', { name: '전체 리포트 생성 조건 새로고침', exact: true }).click();
  await expect(generate).toBeDisabled();
  fixture.setOpen(false);
  await page.getByRole('button', { name: '전체 리포트 생성 조건 새로고침', exact: true }).click();
  await expect(generate).toBeEnabled();
  expect(fixture.generatedTeams).toEqual([]);
  await generate.click();
  await expect(page.getByRole('heading', { name: '전체 리포트 생성 완료', exact: true })).toBeVisible();
  expect(fixture.generatedTeams).toEqual([1, 2]);
  expect([...fixture.reports.values()].every((report) => report.status === 'UNPUBLISHED')).toBe(true);
});

test('일부 팀 생성 실패 후 재시도는 이미 생성된 리포트를 건너뛰고 결과를 공개하지 않는다', async ({ page }) => {
  const fixture = await batchReportBackend(page, { failSecondOnce: true });
  await page.goto('/spaces/1/reports');
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByText('일부 리포트를 생성하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.locator('.report-generation-failures')).toContainText('테스트 2팀');
  await expect(page.locator('.report-publication-status')).toHaveText('미공개');
  expect(fixture.generatedTeams).toEqual([1, 2]);
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 리포트 생성 완료', exact: true })).toBeVisible();
  expect(fixture.generatedTeams).toEqual([1, 2, 2]);
  await page.getByLabel('리포트 대상 팀', { exact: true }).selectOption('2');
  await expect(page.locator('.report-publication-status')).toHaveText('미공개');
  expect([...fixture.reports.values()].every((report) => report.status === 'UNPUBLISHED')).toBe(true);
});

test('생성 직전 전체 제출 조건을 다시 확인하고 변경되면 생성 요청을 보내지 않는다', async ({ page }) => {
  const fixture = await batchReportBackend(page);
  await page.goto('/spaces/1/reports');
  const generate = page.getByRole('button', { name: '전체 리포트 생성', exact: true });
  await expect(generate).toBeEnabled();
  fixture.setMissing(true);
  await generate.click();
  await expect(page.getByRole('alert')).toContainText('전체 팀의 중간·최종 평가 마감');
  expect(fixture.generatedTeams).toEqual([]);
});

async function fillReportWeights(page, values) {
  for (const [label, value] of Object.entries(values))
    await page.getByRole('spinbutton', { name: `${label} 반영 비율`, exact: true }).fill(String(value));
}

test('관리자는 0을 포함한 정수 비율만 합계 100으로 설정하고 모든 팀에 동일하게 전송한다', async ({ page }) => {
  const fixture = await batchReportBackend(page);
  await page.goto('/spaces/1/reports');
  const generate = page.getByRole('button', { name: '전체 리포트 생성', exact: true });
  await expect(generate).toBeEnabled();
  await fillReportWeights(page, { '완료 작업': 50, '중간 동료 평가': 20, '최종 동료 평가': 20 });
  await expect(generate).toBeDisabled();
  await expect(page.getByText('각 항목은 0~100의 정수이며, 합계가 100%여야 합니다.', { exact: false })).toBeVisible();
  await fillReportWeights(page, { '완료 작업': 50.5, '최종 동료 평가': 29.5 });
  await expect(generate).toBeDisabled();
  await fillReportWeights(page, { '완료 작업': '', '최종 동료 평가': 80 });
  await expect(generate).toBeDisabled();
  expect(fixture.generatedTeams).toEqual([]);
  await fillReportWeights(page, { '완료 작업': 0, '중간 동료 평가': 0, '최종 동료 평가': 100 });
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(page.getByRole('heading', { name: '전체 리포트 생성 완료', exact: true })).toBeVisible();
  expect(fixture.generationWeights).toEqual([{ taskPercent: 0, midPercent: 0, finalPercent: 100 }, { taskPercent: 0, midPercent: 0, finalPercent: 100 }]);
  await page.locator('.report-weights-disclosure > summary').click();
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: '담당자 계산 근거 보기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '담당자님의 기여도 상세', exact: true });
  await expect(dialog).toContainText('반영 비중 0%');
  const help = dialog.getByRole('button', { name: '최종 동료 평가 반영분 설명', exact: true });
  await help.focus();
  await expect(dialog.getByRole('tooltip')).toContainText('반영 비중 100% = 60.0%p');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByText('집계 기준과 계산 방식', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '완료 작업 0% · 중간 동료 평가 0% · 최종 동료 평가 100%', exact: true })).toBeVisible();
  await page.reload();
  await page.locator('.report-weights-disclosure > summary').click();
  await expect(page.getByRole('spinbutton', { name: '최종 동료 평가 반영 비율', exact: true })).toHaveValue('100');
  await expect(page.getByRole('spinbutton', { name: '최종 동료 평가 반영 비율', exact: true })).toBeDisabled();
});

test('일부 생성 후 비율은 고정되고 미생성 팀 재시도에도 같은 비율을 사용한다', async ({ page }) => {
  const fixture = await batchReportBackend(page, { failSecondOnce: true });
  await page.goto('/spaces/1/reports');
  await fillReportWeights(page, { '완료 작업': 50, '중간 동료 평가': 20, '최종 동료 평가': 30 });
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.locator('.report-generation-failures')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toHaveValue('50');
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 리포트 생성 완료', exact: true })).toBeVisible();
  expect(fixture.generatedTeams).toEqual([1, 2, 2]);
  expect(fixture.generationWeights).toEqual(Array(3).fill({ taskPercent: 50, midPercent: 20, finalPercent: 30 }));
});

test('다른 관리자가 먼저 확정한 비율을 생성 직전에 다시 확인하고 이전 입력을 전송하지 않는다', async ({ page }) => {
  const fixture = await batchReportBackend(page);
  await page.goto('/spaces/1/reports');
  const generate = page.getByRole('button', { name: '전체 리포트 생성', exact: true });
  await expect(generate).toBeEnabled();
  fixture.setLockedWeights({ taskPercent: 60, midPercent: 0, finalPercent: 40 });
  await generate.click();
  await expect(page.getByRole('alert')).toContainText('반영 비율이 이미 확정');
  expect(fixture.generatedTeams).toEqual([]);
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toHaveValue('60');
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toBeDisabled();
});

test('생성 중 비율 확정 충돌이 발생하면 다음 팀 요청을 중단하고 확정 비율을 갱신한다', async ({ page }) => {
  const fixture = await batchReportBackend(page);
  const attempts = [];
  await page.route('**/api/teams/*/report', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts.push(route.request().postDataJSON());
    fixture.setLockedWeights({ taskPercent: 80, midPercent: 0, finalPercent: 20 });
    return route.fulfill({ status: 409, json: { code: 'REPORT_WEIGHTS_LOCKED', message: '비율 확정' } });
  });
  await page.goto('/spaces/1/reports');
  await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('스페이스 공통 반영 비율이 이미 확정');
  expect(attempts).toEqual([{ taskPercent: 70, midPercent: 10, finalPercent: 20 }]);
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toHaveValue('80');
  await expect(page.getByRole('spinbutton', { name: '완료 작업 반영 비율', exact: true })).toBeDisabled();
});
