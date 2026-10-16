import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { fillDateTime } from './helpers/dateTime.js';

const members = [
  {
    userId: '00000000-0000-4000-8000-000000000001',
    name: '담당자',
    role: 'MEMBER',
  },
  {
    userId: '00000000-0000-4000-8000-000000000002',
    name: '승인자',
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
  const space = {
    id: 1,
    name: '실제 API 스페이스',
    myRole: manager ? 'MANAGER' : 'USER',
    version: 1,
    teamBuildingStatus: 'CLOSED',
    teamBuildingOpensAt: '2026-01-01T09:00:00+09:00',
    teamBuildingClosesAt: '2026-01-02T09:00:00+09:00',
  };
  const team = {
    id: 1,
    spaceId: 1,
    name: '실제 API 팀',
    leaderId: members[1].userId,
    deputyId: null,
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
      opensAt: '2026-01-03T09:00:00+09:00',
      closesAt: '2030-12-01T18:00:00+09:00',
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
    startAt: '2030-11-01T09:00:00+09:00',
    dueAt: '2030-12-01T18:00:00+09:00',
    completionReviewerId: members[1].userId,
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
          updatedAt: '2026-10-14T10:00:00Z',
          submittedAt: '2026-10-14T10:01:00Z',
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
        approvalStatus: null,
        deliverableSummary: [],
      });
    if (path === '/api/tasks/10/approvals') return respond([]);
    if (path === '/api/teams/1/deliverables') return respond([]);
    if (path === '/api/teams/1/my-work-summary')
      return respond({
        teamId: 1,
        asOf: '2026-10-14T10:00:00Z',
        teamTotalWeight: 0,
        teamDoneWeight: 0,
        myAssignedWeight: 0,
        myDoneWeight: 0,
        teamProgressRate: null,
        myAssignedShare: null,
        myCompletedContributionRate: null,
        myTaskCompletionRate: null,
        myPendingApprovalCount: 7,
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
      space.membershipLockedAt = '2026-10-14T10:00:00Z';
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
        updatedAt: new Date().toISOString(),
        submittedAt: null,
      };
      return respond(response);
    }
    if (path === '/api/evaluation-rounds/11/submit') {
      response.submittedAt = '2026-10-14T10:00:00Z';
      rounds[0].mySubmissionStatus = 'SUBMITTED';
      return respond({ roundId: 11, submittedAt: response.submittedAt });
    }
    if (path === '/api/teams/1/mid-feedback')
      return respond({
        roundId: 11,
        teamId: 1,
        asOf: '2026-10-14T10:00:00Z',
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
        asOf: '2026-10-14T10:00:00Z',
        totalTeamCount: 1,
        unassignedCount: 2,
        pendingApplications: 1,
        overdueTaskCount: 2,
        staleTaskCount: 3,
        pendingApprovalCount: 1,
        teams: [
          {
            teamId: 1,
            teamName: team.name,
            leaderName: '승인자',
            leaderId: members[1].userId,
            approvedMemberCount: 2,
            hasMinimumMembers: true,
            pendingApplications: 1,
            totalTaskCount: 3,
            todoTaskCount: 1,
            inProgressTaskCount: 1,
            pendingApprovalCount: 0,
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
                    pendingApprovalCount: 0,
                    doneTaskCount: 0,
                    overdueTaskCount: 0,
                    approvedWorkWeight: 0,
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
          createdAt: '2026-10-14T10:00:00Z',
          updatedAt: '2026-10-14T10:00:00Z',
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
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1');
  await expect(
    page.getByRole('button', { name: /내 승인 대기.*7건/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /내 마감 지연.*9건/ }),
  ).toBeVisible();
  await expect(page.getByText('계산할 작업 없음').first()).toBeVisible();
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
  expect(
    requests.some((request) => request.path.endsWith('/my-work-summary')),
  ).toBeTruthy();
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
  await expect(page.getByRole('button', { name: /내 승인 대기/ })).toHaveCount(
    0,
  );
});
test('동료 평가는 실제 PUT과 POST로 저장·제출하고 새로고침 후 잠근다', async ({
  page,
}) => {
  const { requests } = await backend(page);
  await page.goto('/spaces/1/teams/1/peer-evaluations');
  for (const label of ['작업 수행', '책임감', '협업', '의사소통'])
    await page.getByLabel(`승인자 ${label} 4점`, { exact: true }).check();
  await page.getByRole('button', { name: '승인자 평가 저장' }).click();
  await page.getByRole('button', { name: '최종 제출', exact: true }).click();
  await page.getByRole('button', { name: '제출 확정' }).click();
  await expect(page.getByText('최종 제출 완료', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('승인자 작업 수행 4점')).toBeDisabled();
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
  await expect(page.getByLabel('승인자 작업 수행 4점')).toBeDisabled();
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
test('중간 피드백은 실제 서버 평균과 행동 안내를 제공한다', async ({
  page,
}) => {
  await backend(page);
  await page.goto('/spaces/1/teams/1/mid-feedback');
  await expect(page.getByText('4.25 / 5', { exact: true })).toBeVisible();
  await expect(page.getByText('역할 조율을 함께 확인해 보세요.')).toBeVisible();
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
});
test('관리자 대시보드는 현재 DTO의 가중 진행률과 선택 팀 구성원을 표시한다', async ({
  page,
}) => {
  const { requests } = await backend(page, {
    manager: true,
    roundStatus: 'DRAFT',
  });
  await page.goto('/spaces/1/dashboard');
  await expect(page.getByText('25.00%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('참여자 고정 전', { exact: true })).toBeVisible();
  await expect(page.getByText('AI 확인 필요', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('columnheader', { name: '리포트', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: /팀원 수행 현황/ }),
  ).toHaveCount(0);
  await page.getByLabel('조회할 팀').selectOption('1');
  await expect(
    page.getByRole('heading', { name: '실제 API 팀 · 팀원 수행 현황' }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.path.endsWith('manager-dashboard') &&
        request.query === '?teamId=1',
    ),
  ).toBeTruthy();
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
  ).toEqual({ closesAt: '2030-12-02T18:00:00+09:00', expectedVersion: 3 });
});
test('AI 검토는 수동 요청 후 진행 상태를 조회하고 점수 없이 근거·질문을 표시한다', async ({
  page,
}) => {
  const { requests, setReview } = await backend(page);
  await page.goto('/spaces/1/teams/1/tasks/10');
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

test('회차 생성과 개방은 실제 POST를 사용하고 팀 구성 변경을 다시 조회한다', async ({
  page,
}) => {
  const { requests } = await backend(page, {
    manager: true,
    roundStatus: 'DRAFT',
  });
  await page.goto('/spaces/1/rounds');
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
    .getByRole('button', { name: '평가 회차 만들기', exact: true })
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
    opensAt: '2030-12-02T09:00:00+09:00',
    closesAt: '2030-12-03T18:00:00+09:00',
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

const contributionDetails = (percent) => ({
  taskRatioPercent: percent,
  midRatioPercent: percent,
  finalRatioPercent: percent,
  taskContributionPercent: percent * 0.7,
  midContributionPercent: percent * 0.1,
  finalContributionPercent: percent * 0.2,
  roundingAdjustmentPercent: 0,
  totalPercent: percent,
});
function reportResponse(manager, status = 'UNPUBLISHED') {
  return {
    id: 40,
    teamId: 1,
    status,
    cutoffAt: '2026-10-14T10:00:00Z',
    createdAt: '2026-10-15T10:00:00Z',
    publishedAt: status === 'PUBLISHED' ? '2026-10-15T11:00:00Z' : null,
    totalPercent: 100,
    members: members.map((member, index) => ({
      userId: member.userId,
      name: member.name,
      contributionPercent: index ? 40 : 60,
      ...(manager ? { details: contributionDetails(index ? 40 : 60) } : {}),
    })),
    myDetails: manager ? null : contributionDetails(60),
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
        publishedAt: '2026-10-15T11:00:00Z',
      };
    else if (request.method() === 'POST') report ||= reportResponse(manager);
    return route.fulfill({ json: report });
  });
  return fixture;
}

test('리포트를 실제 생성·검토·공개하고 다른 팀 미제출은 공개를 막지 않는다', async ({
  page,
}) => {
  const fixture = await reportBackend(page);
  await page.goto('/spaces/1/reports');
  await expect(
    page.getByRole('button', { name: '리포트 생성', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '리포트 생성', exact: true }).click();
  await page.getByText('담당자님의 계산 근거 보기', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '담당자님의 계산 근거' }),
  ).toBeVisible();
  await page.getByText('승인자님의 계산 근거 보기', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '승인자님의 계산 근거' }),
  ).toBeVisible();
  await expect(page.getByText('목업', { exact: true })).toHaveCount(0);
  await expect(page.getByText('AI 작업 평가', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '리포트 공개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '공개 확정' })
    .click();
  await expect(
    page.getByText('공개된 최종 결과', { exact: true }),
  ).toBeVisible();
  for (const path of ['/api/teams/1/report', '/api/reports/40/publish']) {
    const request = fixture.requests.find(
      (request) => request.path === path && request.method === 'POST',
    );
    expect(request.body).toBeNull();
    expect(request.query).toBe('');
    expect(request.headers['x-csrf-token']).toBe('test-token');
  }
  await page.reload();
  await expect(
    page.getByText('공개된 최종 결과', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '리포트 공개', exact: true }),
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
  await expect(page.getByText('승인 작업', { exact: true })).toBeVisible();
  await expect(page.getByText('승인자님의 계산 근거 보기')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '동료 평가 원문', exact: true }),
  ).toHaveCount(0);
  expect(
    fixture.requests.some(
      (request) =>
        request.path.endsWith('/manager-dashboard') ||
        /teams\/1\/responses$/.test(request.path),
    ),
  ).toBe(false);
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

test('표시상 마감 후에도 서버 마감 정리와 승인 작업 부족 오류를 안내한다', async ({
  page,
}) => {
  const fixture = await reportBackend(page, {
    generateError: { code: 'REPORT_INPUT_INCOMPLETE' },
  });
  await page.goto('/spaces/1/reports');
  await page.getByRole('button', { name: '리포트 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('서버의 마감 정리');
  await expect(
    page.getByRole('heading', { name: '생성된 리포트가 없습니다.' }),
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
  await page.getByRole('button', { name: '리포트 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '승인 작업 또는 평가 입력이 부족',
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
  await page.getByRole('button', { name: '리포트 공개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '공개 확정' })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '해당 팀의 두 회차 마감',
  );
  await expect(
    page.getByText('관리자 검토용 비공개 리포트', { exact: true }),
  ).toBeVisible();
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
            submittedAt: '2026-10-15T10:00:00Z',
          },
        ],
      },
    }),
  );
  await page.goto('/spaces/1/rounds');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await expect(
    page.getByRole('heading', { name: '평가 회차 관리', exact: true }),
  ).toBeVisible();
  expect(
    fixture.requests.some((request) =>
      /teams\/1\/responses$/.test(request.path),
    ),
  ).toBe(false);
  await panel.getByText('동료 평가 원문 보기', { exact: true }).click();
  await expect(panel.getByText('관리자 전용 제출 사유입니다.')).toBeHidden();
  await panel.getByText('평가 대상자 받은 평가 · 1건', { exact: true }).click();
  await expect(panel.getByText('평가 작성자 → 평가 대상자')).toBeVisible();
  await expect(panel.getByText('관리자 전용 제출 사유입니다.')).toBeVisible();
  await expect(panel).toContainText('미제출 1명');
  await panel.getByLabel('원문 조회 회차').selectOption('12');
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
  await page.goto('/spaces/1/dashboard');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await panel.getByText('동료 평가 원문 보기', { exact: true }).click();
  await expect(panel).toContainText('마감 정리가 아직 끝나지 않았습니다.');
  forbidden = true;
  await panel.getByRole('button', { name: '평가 원문 새로고침' }).click();
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
          startAt: '2026-10-01T00:00:00Z',
          dueAt: '2026-10-14T10:00:00Z',
          allocationPercent: 60,
          contributionDescription: '서버에 저장한 수행 설명',
          contributionUpdatedAt: '2026-10-14T10:00:00Z',
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
    page.getByRole('button', { name: '리포트 생성', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: '생성된 리포트가 없습니다.' }),
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
  await page.goto('/spaces/1/dashboard');
  const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
  await panel.getByText('동료 평가 원문 보기', { exact: true }).click();
  await expect(panel).toContainText('회차 마감 후 최종 제출된 평가를 조회');
  fixture.rounds[0].status = 'CLOSED';
  await panel.getByRole('button', { name: '원문 조회 회차 새로고침' }).click();
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
    leaderName: '승인자',
    approvedMemberCount: 2,
    hasMinimumMembers: true,
    pendingApplications: 0,
    totalTaskCount: 4,
    todoTaskCount: 1,
    inProgressTaskCount: 2,
    pendingApprovalCount: 0,
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
        asOf: '2026-10-14T10:00:00Z',
        totalTeamCount: 3,
        unassignedCount: 0,
        pendingApplications: 0,
        overdueTaskCount: 4,
        staleTaskCount: 0,
        pendingApprovalCount: 0,
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
    name: '팀별 진행 현황',
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
  const draft = page.getByRole('article', {
    name: '중간 평가 제출 현황',
    exact: true,
  });
  await expect(draft).toContainText('참여자 고정 전');
  await expect(draft.getByRole('progressbar')).toHaveCount(0);
  const openRound = page.getByRole('article', {
    name: '최종 평가 제출 현황',
    exact: true,
  });
  await expect(openRound).toContainText('미제출 4명');
  expect(
    Number(
      await openRound.getByRole('progressbar').getAttribute('aria-valuenow'),
    ),
  ).toBeCloseTo(33.33, 2);
  expect(requests.some((request) => request.path.endsWith('/responses'))).toBe(
    false,
  );
});
