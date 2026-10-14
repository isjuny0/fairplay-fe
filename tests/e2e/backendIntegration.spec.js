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
  { manager = false, roundStatus = 'OPEN', participating = true } = {},
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
  const task = {
    id: 10,
    teamId: 1,
    title: '현재 작업',
    description: '연결 자료에 근거한 작업 설명입니다.',
    status: 'IN_PROGRESS',
    version: 2,
    weight: 3,
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
        missingPeerSubmissions: [
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
  ).toHaveCount(0);
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
