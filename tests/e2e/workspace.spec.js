import { expect, test } from '@playwright/test';

const members = [
  { userId: 'leader', name: '리더', isLeader: true, isDeputy: false },
  { userId: 'member', name: '담당자', isLeader: false, isDeputy: false },
];

function deletionRequest(overrides = {}) {
  return {
    id: 40,
    teamId: 1,
    status: 'PENDING',
    version: 0,
    requestedBy: 'leader',
    requestedAt: '2026-10-06T10:00:00+09:00',
    requiredCount: 2,
    agreedCount: 0,
    myConsented: false,
    canDelete: false,
    taskCount: 1,
    deliverableCount: 2,
    workFrozen: true,
    members: members.map((member) => ({
      userId: member.userId,
      name: member.name,
      consented: false,
      consentedAt: null,
      decision: 'UNANSWERED',
    })),
    ...overrides,
  };
}

async function workspace(
  page,
  {
    userId = 'member',
    manager = false,
    memberCount = 2,
    initialDeletion = null,
    membershipLocked = false,
    leaveBlocked = false,
    deletionLoadError = null,
  } = {},
) {
  const requests = [];
  let task = {
    id: 10,
    teamId: 1,
    title: '회원 탈퇴 구현',
    description: '탈퇴 정책에 따라 기능 구현',
    weight: 3,
    dueAt: '2030-12-01T18:00:00+09:00',
    status: 'IN_PROGRESS',
    version: 0,
    completionReviewerId: 'leader',
    assignees: [{ userId: 'member', allocationPercent: 100 }],
    canRequestCompletion: true,
  };
  let approvals = [];
  let deliverables = [];
  let joinCode = null;
  let conflict = false;
  let expired = false;
  let deletion = initialDeletion;
  let teamRemoved = false;
  let deletionConflict = false;
  const team = {
    id: 1,
    spaceId: 1,
    name: '삼위일체 팀',
    leaderId: 'leader',
    deputyId: null,
    myMembershipStatus: manager ? null : 'APPROVED',
    approvedMemberCount: memberCount,
    teamBuildingStatus: 'OPEN',
    canCreateTask: !manager && memberCount >= 2,
  };
  const space = {
    id: 1,
    spaceId: 1,
    name: '프로젝트 스페이스',
    description: '우리 프로젝트',
    startAt: '2026-01-01T00:00:00+09:00',
    endAt: '2030-12-31T23:00:00+09:00',
    teamBuildingOpensAt: '2026-01-01T00:00:00+09:00',
    teamBuildingClosesAt: '2030-12-31T23:00:00+09:00',
    teamBuildingStatus: 'OPEN',
    version: 0,
    myRole: manager ? 'MANAGER' : 'MEMBER',
    membershipLockedAt: membershipLocked ? '2026-10-06T10:00:00+09:00' : null,
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push({
      method,
      path,
      query: url.search,
      body: request.postData(),
      headers: request.headers(),
    });
    const respond = (body, status = 200) =>
      route.fulfill({ status, json: body });
    if (expired)
      return respond(
        { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        401,
      );
    if (path === '/api/auth/csrf')
      return respond({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path === '/api/me')
      return respond({
        id: userId,
        name: manager ? '교수' : userId === 'leader' ? '리더' : '담당자',
      });
    if (path === '/api/auth/google')
      return respond({
        id: userId,
        name: userId === 'leader' ? '리더' : '담당자',
      });
    if (path === '/api/auth/logout') {
      expired = true;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/spaces')
      return respond(
        method === 'POST' ? space : [{ ...space, role: space.myRole }],
      );
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/team-building-period') {
      Object.assign(space, request.postDataJSON(), {
        version: space.version + 1,
      });
      return respond(space);
    }
    if (path === '/api/spaces/1/join-code') {
      if (method === 'GET')
        return joinCode
          ? respond(joinCode)
          : respond(
              {
                code: 'JOIN_CODE_NOT_FOUND',
                message: '유효한 코드가 없습니다.',
              },
              404,
            );
      joinCode = {
        spaceId: 1,
        code: 'A1B2C3D4',
        createdAt: '2026-10-05T10:00:00+09:00',
        expiresAt: '2030-12-31T23:00:00+09:00',
      };
      return respond(joinCode, 201);
    }
    if (path === '/api/spaces/1/join-code/revoke') {
      joinCode = null;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/spaces/1/teams')
      return respond(teamRemoved ? [] : [team]);
    if (path === '/api/teams/1') {
      if (method === 'DELETE') {
        if (deletionConflict) {
          deletion.version++;
          return respond(
            {
              code: 'VERSION_CONFLICT',
              message: '동의 현황이 변경되었습니다.',
            },
            409,
          );
        }
        if (
          url.searchParams.get('expectedVersion') !==
            String(deletion.version) ||
          url.searchParams.get('deletionRequestId') !== String(deletion.id)
        )
          return respond(
            { code: 'VERSION_CONFLICT', message: '잘못된 요청 버전입니다.' },
            409,
          );
        teamRemoved = true;
        return route.fulfill({ status: 204 });
      }
      return respond(team);
    }
    if (path === '/api/teams/1/deletion-request') {
      if (deletionLoadError)
        return respond(
          {
            code: deletionLoadError,
            message: '삭제 현황을 확인할 수 없습니다.',
          },
          404,
        );
      return deletion
        ? respond(deletion)
        : respond(
            {
              code: 'TEAM_DELETION_REQUEST_NOT_FOUND',
              message: '삭제 요청이 없습니다.',
            },
            404,
          );
    }
    if (path === '/api/teams/1/deletion-requests') {
      deletion = deletionRequest({
        id: (deletion?.id || 39) + 1,
        requiredCount: memberCount,
        members: deletionRequest().members.slice(0, memberCount),
      });
      return respond(deletion, 201);
    }
    if (/^\/api\/team-deletion-requests\/\d+\/consent$/.test(path)) {
      const agree = request.postDataJSON().agree;
      deletion.members = deletion.members.map((member) =>
        member.userId === userId
          ? {
              ...member,
              consented: agree,
              decision: agree ? 'AGREED' : 'REJECTED',
              consentedAt: agree ? '2026-10-06T11:00:00+09:00' : null,
            }
          : member,
      );
      deletion.agreedCount = deletion.members.filter(
        (member) => member.consented,
      ).length;
      deletion.myConsented = agree;
      deletion.status = agree
        ? deletion.agreedCount === deletion.requiredCount
          ? 'READY'
          : 'PENDING'
        : 'CANCELLED';
      deletion.workFrozen = agree;
      deletion.canDelete =
        deletion.status === 'READY' && userId === 'leader' && !membershipLocked;
      deletion.version++;
      return respond(deletion);
    }
    if (path === '/api/teams/1/members/me') {
      if (leaveBlocked)
        return respond(
          {
            code: 'TEAM_LEAVE_HAS_DEPENDENCIES',
            message: '탈퇴할 수 없습니다.',
          },
          409,
        );
      if (userId === team.leaderId)
        team.leaderId = url.searchParams.get('nextLeaderId');
      team.myMembershipStatus = null;
      team.approvedMemberCount--;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/teams/1/members')
      return respond(members.slice(0, memberCount));
    if (path === '/api/teams/1/tasks') {
      if (method === 'POST') {
        task = {
          ...task,
          ...request.postDataJSON(),
          status: 'TODO',
          canRequestCompletion: false,
          completionBlockReason: 'INVALID_TASK_STATE',
        };
        return respond(task, 201);
      }
      return respond([task]);
    }
    if (path === '/api/tasks/10') {
      if (method === 'PATCH') {
        if (conflict)
          return respond(
            {
              code: 'VERSION_CONFLICT',
              message: '다른 사용자가 먼저 수정했습니다.',
            },
            409,
          );
        task = {
          ...task,
          ...request.postDataJSON(),
          version: task.version + 1,
        };
        task.canRequestCompletion = task.status === 'IN_PROGRESS';
        task.completionBlockReason = task.canRequestCompletion
          ? null
          : 'INVALID_TASK_STATE';
        return respond(task);
      }
      return respond({
        task,
        deliverableSummary: [],
        approvalStatus: approvals[0]?.status || null,
        contributions: task.assignees.map(({ userId: assigneeId }) => ({
          userId: assigneeId,
          contributionDescription: '탈퇴 정책 구현과 테스트를 수행했습니다.',
        })),
      });
    }
    if (path === '/api/tasks/10/approvals' || path === '/api/teams/1/approvals')
      return respond(approvals);
    if (path === '/api/tasks/10/completion-requests') {
      approvals = [
        {
          id: 20,
          taskId: 10,
          status: 'PENDING',
          requesterId: 'member',
          reviewerId: 'leader',
          requestedAt: '2026-10-05T10:00:00+09:00',
        },
      ];
      task = {
        ...task,
        status: 'PENDING_APPROVAL',
        version: task.version + 1,
        canRequestCompletion: false,
      };
      return respond(approvals[0], 201);
    }
    if (path === '/api/approvals/20/reject') {
      approvals[0] = {
        ...approvals[0],
        status: 'REJECTED',
        reason: request.postDataJSON().reason,
        decidedAt: '2026-10-05T11:00:00+09:00',
      };
      task = { ...task, status: 'IN_PROGRESS', version: task.version + 1 };
      return respond({ ...approvals[0], taskStatus: task.status });
    }
    if (path === '/api/approvals/20/approve') {
      approvals[0] = {
        ...approvals[0],
        status: 'APPROVED',
        decidedAt: '2026-10-05T11:00:00+09:00',
      };
      task = { ...task, status: 'DONE', version: task.version + 1 };
      return respond({ ...approvals[0], taskStatus: task.status });
    }
    if (path === '/api/teams/1/applications') return respond([]);
    if (path === '/api/teams/1/deliverables') return respond(deliverables);
    if (path === '/api/teams/1/deliverables/files') {
      deliverables = [
        {
          id: 30,
          teamId: 1,
          taskId: null,
          authorId: userId,
          title: '설계 원본',
          category: 'OTHER',
          type: 'FILE',
          version: 0,
          updatedAt: '2026-10-05T10:00:00+09:00',
          file: {
            originalFilename: 'design.md',
            sizeBytes: 8,
            contentType: 'text/markdown',
          },
        },
      ];
      return respond(deliverables[0], 201);
    }
    if (path === '/api/deliverables/30/file')
      return route.fulfill({ contentType: 'text/markdown', body: '# design' });
    return respond(
      { code: 'UNEXPECTED_TEST_API', message: `${method} ${path}` },
      501,
    );
  });
  await page.goto('/main');
  await page.getByRole('button', { name: /프로젝트 스페이스/ }).click();
  await page
    .getByRole('button', {
      name: manager ? '팀 자료 조회' : '팀 열기',
      exact: true,
    })
    .click();
  return {
    requests,
    setDeletion: (value) => {
      deletion = value;
    },
    setDeletionConflict: () => {
      deletionConflict = true;
    },
    setConflict: () => {
      conflict = true;
    },
    expire: () => {
      expired = true;
    },
    renew: () => {
      expired = false;
    },
    setTaskTeamId: (id) => {
      task.teamId = id;
    },
    setPending: () => {
      approvals = [
        {
          id: 20,
          taskId: 10,
          status: 'PENDING',
          requesterId: 'member',
          reviewerId: 'leader',
        },
      ];
      task.status = 'PENDING_APPROVAL';
    },
  };
}

for (const [label, weight] of [
  ['1시간 미만의 작업', 1],
  ['1시간 이상 ~ 3시간 미만의 작업', 2],
  ['3시간 이상 ~ 6시간 미만의 작업', 3],
  ['6시간 이상 ~ 12시간 미만의 작업', 5],
  ['12시간 이상의 작업', 8],
])
  test(`예상 작업량 ${label} 선택은 숫자 가중치 ${weight}로 저장된다`, async ({ page }) => {
    const { requests } = await workspace(page);
    await page.getByRole('button', { name: '작업 보드', exact: true }).click();
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const workload = dialog.getByLabel('예상 작업량', { exact: true });
    await expect(workload).toHaveValue('3');
    await expect(workload.locator('option')).toHaveText([
      '1시간 미만의 작업',
      '1시간 이상 ~ 3시간 미만의 작업',
      '3시간 이상 ~ 6시간 미만의 작업',
      '6시간 이상 ~ 12시간 미만의 작업',
      '12시간 이상의 작업',
    ]);
    await workload.selectOption({ label });
    await dialog.getByLabel('작업 제목').fill('예상 작업량 확인');
    await dialog.getByLabel('작업 설명', { exact: true }).fill('팀과 합의한 작업 범위입니다.');
    await dialog.getByLabel('마감 (한국 시간)').fill('2030-12-01T18:00');
    await dialog.getByLabel('담당자 · 팀원').check();
    await dialog.getByLabel('완료 승인자', { exact: true }).selectOption('leader');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('heading', { name: '예상 작업량 확인' })).toBeVisible();
    const request = requests.find(({ method, path }) =>
      method === 'POST' && path === '/api/teams/1/tasks');
    expect(JSON.parse(request.body).weight).toBe(weight);
    await expect(page.getByText(`예상 작업량: ${label}`, { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    await expect(dialog.getByLabel('예상 작업량', { exact: true })).toHaveValue(String(weight));
    const changedLabel = weight === 8 ? '1시간 미만의 작업' : '12시간 이상의 작업';
    await dialog.getByLabel('예상 작업량', { exact: true }).selectOption({ label: changedLabel });
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const update = requests.find(({ method, path }) =>
      method === 'PATCH' && path === '/api/tasks/10');
    expect(JSON.parse(update.body)).toMatchObject({ weight: weight === 8 ? 1 : 8, expectedVersion: 0 });
    await page.reload();
    await expect(page.getByText(`예상 작업량: ${changedLabel}`, { exact: false })).toBeVisible();
  });

test('담당자가 작업을 생성하고 버전으로 완료 요청하면 수정이 잠긴다', async ({
  page,
}) => {
  const { requests } = await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목').fill('새 기능 구현');
  await dialog
    .getByLabel('작업 설명', { exact: true })
    .fill('완료 조건과 담당 범위를 정의합니다.');
  await dialog.getByLabel('마감 (한국 시간)').fill('2030-12-01T18:00');
  await dialog.getByLabel('담당자 · 팀원').check();
  await dialog
    .getByLabel('완료 승인자', { exact: true })
    .selectOption('leader');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '새 기능 구현' }),
  ).toBeVisible();
  const creation = requests.find(
    ({ method, path }) => method === 'POST' && path === '/api/teams/1/tasks',
  );
  expect(JSON.parse(creation.body)).toMatchObject({
    dueAt: '2030-12-01T18:00:00+09:00',
    completionReviewerId: 'leader',
    assignees: [{ userId: 'member', allocationPercent: 100 }],
  });
  expect(creation.headers['x-csrf-token']).toBe('test-token');
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '작업 시작', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '완료 요청', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  expect(
    JSON.parse(
      requests.find(({ path }) => path.endsWith('/completion-requests')).body,
    ),
  ).toEqual({ expectedVersion: 1 });
});

test('지정 승인자가 사유를 입력해 반려하면 이력과 작업 수정이 다시 열린다', async ({
  page,
}) => {
  const state = await workspace(page, { userId: 'leader' });
  state.setPending();
  await page.getByRole('button', { name: '승인 검토', exact: true }).click();
  await page.getByRole('button', { name: '작업 검토', exact: true }).click();
  await page
    .getByLabel('반려 사유')
    .fill('탈퇴 후 게시글 처리 테스트를 보완해 주세요.');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  await page.getByText('완료 요청 이력 · 1건', { exact: true }).click();
  await expect(
    page.getByText('반려 사유: 탈퇴 후 게시글 처리 테스트를 보완해 주세요.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toBeVisible();
});

test('팀원이 1명이면 작업 생성 버튼이 비활성화된다', async ({ page }) => {
  await workspace(page, { userId: 'leader', memberCount: 1 });
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 작업 만들기', exact: true }),
  ).toBeDisabled();
});

test('지정 승인자가 승인하면 완료 상태가 되고 수정·등록이 잠긴다', async ({
  page,
}) => {
  const state = await workspace(page, { userId: 'leader' });
  state.setPending();
  await page.getByRole('button', { name: '승인 검토', exact: true }).click();
  await page.getByRole('button', { name: '작업 검토', exact: true }).click();
  await page.getByRole('button', { name: '완료 승인', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '승인 확정', exact: true }).click();
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toHaveCount(0);
  expect(
    state.requests.find(({ path }) => path === '/api/approvals/20/approve')
      .body,
  ).toBe(null);
});

test('스페이스 관리자는 타 팀 자료만 조회하고 팀 작업 API를 호출하지 않는다', async ({
  page,
}) => {
  const { requests } = await workspace(page, {
    manager: true,
    userId: 'manager',
  });
  await expect(
    page.getByRole('button', { name: '작업 보드', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(page.getByText('등록된 산출물이 없습니다.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toHaveCount(0);
  expect(requests.some(({ path }) => path === '/api/teams/1/tasks')).toBe(
    false,
  );
});

test('버전 충돌에서 요청을 재전송하지 않고 입력 내용을 유지한다', async ({
  page,
}) => {
  const state = await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await page.getByRole('button', { name: '작업 수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목').fill('입력 보존 확인');
  state.setConflict();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    '다른 사용자가 먼저 수정했습니다.',
  );
  await expect(dialog.getByLabel('작업 제목')).toHaveValue('입력 보존 확인');
  expect(
    state.requests.filter(
      ({ method, path }) => method === 'PATCH' && path === '/api/tasks/10',
    ),
  ).toHaveLength(1);
});

test('파일 산출물을 multipart로 업로드하고 인증을 유지해 다운로드한다', async ({
  page,
}) => {
  const { requests } = await workspace(page);
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목', { exact: true }).fill('설계 원본');
  await dialog.getByLabel('자료 유형').selectOption('FILE');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: 'design.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# design'),
  });
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설계 원본' })).toBeVisible();
  const upload = requests.find(({ path }) =>
    path.endsWith('/deliverables/files'),
  );
  expect(upload.headers['content-type']).toContain(
    'multipart/form-data; boundary=',
  );
  expect(upload.body).toContain('name="file"; filename="design.md"');
  expect(upload.body).not.toContain('name="type"');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '파일 다운로드' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('design.md');
});

test('세션 만료 응답은 로그인 화면으로 돌아가 안내한다', async ({ page }) => {
  const state = await workspace(page);
  state.expire();
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    '로그인 세션이 만료되었습니다.',
  );
});

test('관리자는 스페이스 생성 후 팀 빌딩 기간을 지정하고 코드를 발급·철회한다', async ({
  page,
}) => {
  const { requests } = await workspace(page, {
    manager: true,
    userId: 'manager',
  });
  await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
  await page
    .getByRole('button', { name: '스페이스 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('스페이스 이름').fill('프로젝트 스페이스');
  await dialog.getByLabel('프로젝트 시작 (한국 시간)').fill('2026-01-01T00:00');
  await dialog.getByLabel('프로젝트 종료 (한국 시간)').fill('2030-12-31T23:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await page
    .getByRole('button', { name: '스페이스 관리', exact: true })
    .click();
  const creation = requests.find(
    ({ path, method }) => path === '/api/spaces' && method === 'POST',
  );
  expect(JSON.parse(creation.body)).not.toHaveProperty('teamBuildingOpensAt');
  await page.getByLabel('팀 빌딩 시작').fill('2026-10-05T10:00');
  await page.getByLabel('팀 빌딩 종료').fill('2026-10-31T18:00');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel('팀 빌딩 시작')).toHaveValue('2026-10-05T10:00');
  expect(
    JSON.parse(
      requests.find(({ path }) => path.endsWith('/team-building-period')).body,
    ),
  ).toMatchObject({
    expectedVersion: 0,
    teamBuildingOpensAt: '2026-10-05T10:00:00+09:00',
  });
  await page.getByLabel('코드 유효 기간', { exact: true }).selectOption('custom');
  await page.getByLabel('유효 기간 (분)').fill('60');
  await page.getByRole('button', { name: '참여 코드 발급', exact: true }).click();
  await expect(page.getByText('A1B2C3D4', { exact: true })).toBeVisible();
  expect(
    JSON.parse(
      requests.find(
        ({ path, method }) => path.endsWith('/join-code') && method === 'POST',
      ).body,
    ),
  ).toEqual({ expirationMinutes: 60 });
  await page.getByRole('button', { name: '철회', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '코드 철회', exact: true }).click();
  await expect(
    page.getByText('유효한 참여 코드가 없습니다.', { exact: true }),
  ).toBeVisible();
});

test('좁은 화면에서도 작업 상세를 가로 넘침 없이 확인한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '회원 탈퇴 구현' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('mobile-task.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath('desktop-task.png'),
    fullPage: true,
  });
});

test('모바일·태블릿·데스크톱에서 팀 탐색과 작업 생성 폼이 가로로 넘치지 않는다', async ({
  page,
}) => {
  await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page
        .getByRole('navigation', { name: '팀 메뉴' })
        .getByRole('button', { name: '작업 보드', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: '새 작업 만들기', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByLabel('완료 승인자', { exact: true }),
    ).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  }
});

async function openTeamSettings(page) {
  await page.getByRole('button', { name: '팀 설정', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '팀 설정', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '현황 새로고침' }),
  ).toBeEnabled();
}

function readyDeletion() {
  return deletionRequest({
    status: 'READY',
    version: 7,
    agreedCount: 2,
    myConsented: true,
    canDelete: true,
    members: members.map((member) => ({
      userId: member.userId,
      name: member.name,
      consented: true,
      consentedAt: '2026-10-06T11:00:00+09:00',
      decision: 'AGREED',
    })),
  });
}

test('리더는 삭제 요청을 만들고 별도로 동의하며 모바일에서 현황을 확인한다', async ({
  page,
}) => {
  const { requests } = await workspace(page, { userId: 'leader' });
  await openTeamSettings(page);
  await page
    .getByRole('button', { name: '팀 삭제 요청 만들기', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('리더도 별도로 동의');
  await page
    .getByRole('button', { name: '삭제 요청 생성', exact: true })
    .click();
  await expect(page.getByText('0 / 2명 동의', { exact: true })).toBeVisible();
  expect(requests.filter(({ method }) => method === 'PUT')).toHaveLength(0);
  await expect(
    page.getByRole('button', { name: '팀 최종 삭제' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '팀 삭제에 동의', exact: true })
    .click();
  await expect(page.getByText('1 / 2명 동의', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '내 동의 완료' }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/team-settings-mobile.png',
    fullPage: true,
  });
  const creation = requests.find(
    ({ path }) => path === '/api/teams/1/deletion-requests',
  );
  expect(creation.body).toBe(null);
  expect(creation.headers['x-csrf-token']).toBe('test-token');
});

test('팀원은 본인 동의만 변경하고 철회하면 요청 전체가 취소된다', async ({
  page,
}) => {
  const { requests } = await workspace(page, {
    initialDeletion: deletionRequest(),
  });
  await openTeamSettings(page);
  await expect(page.getByRole('button', { name: '팀 최종 삭제' })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: '팀 삭제에 동의', exact: true })
    .click();
  await expect(page.getByText('1 / 2명 동의', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '동의 철회 및 요청 취소' }).click();
  await page
    .getByRole('button', { name: '반대 및 요청 취소', exact: true })
    .click();
  await expect(page.getByText('요청 취소', { exact: true })).toBeVisible();
  await expect(page.getByText('반대', { exact: true })).toBeVisible();
  expect(
    requests
      .filter(
        ({ method, path }) => method === 'PUT' && path.endsWith('/consent'),
      )
      .map(({ body }) => JSON.parse(body)),
  ).toEqual([{ agree: true }, { agree: false }]);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 작업 만들기', exact: true }),
  ).toBeEnabled();
});

test('취소·무효화된 요청은 리더가 새로 만들고 전원 재동의한다', async ({
  page,
}) => {
  const state = await workspace(page, {
    userId: 'leader',
    initialDeletion: deletionRequest({
      status: 'INVALIDATED',
      workFrozen: false,
    }),
  });
  await openTeamSettings(page);
  await expect(page.getByText('재동의 필요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 삭제 요청 만들기' }).click();
  await page.getByRole('button', { name: '삭제 요청 생성' }).click();
  await expect(page.getByText('0 / 2명 동의', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '삭제 반대 및 요청 취소' }).click();
  await page
    .getByRole('button', { name: '반대 및 요청 취소', exact: true })
    .click();
  await expect(page.getByText('요청 취소', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 삭제 요청 만들기' }).click();
  await page.getByRole('button', { name: '삭제 요청 생성' }).click();
  await expect(page.getByText('0 / 2명 동의', { exact: true })).toBeVisible();
  expect(
    state.requests.filter(
      ({ path }) => path === '/api/teams/1/deletion-requests',
    ),
  ).toHaveLength(2);
});

test('전원 동의 후 리더가 확인한 버전으로 최종 삭제하면 팀 목록을 갱신한다', async ({
  page,
}) => {
  const { requests } = await workspace(page, {
    userId: 'leader',
    initialDeletion: readyDeletion(),
  });
  await openTeamSettings(page);
  await page.getByRole('button', { name: '팀 최종 삭제', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('작업 1개, 산출물 2개');
  await expect(
    dialog.getByRole('button', { name: '완전히 삭제' }),
  ).toBeDisabled();
  await dialog.getByLabel('삭제 범위와 복구 불가를 확인했습니다.').check();
  await dialog.getByRole('button', { name: '완전히 삭제' }).click();
  await expect(
    page.getByRole('heading', { name: '프로젝트 스페이스', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('아직 생성된 팀이 없습니다.', { exact: true }),
  ).toBeVisible();
  const deletion = requests.find(
    ({ method, path }) => method === 'DELETE' && path === '/api/teams/1',
  );
  expect(deletion.query).toBe('?deletionRequestId=40&expectedVersion=7');
  await expect(page).toHaveURL(/\/spaces\/1$/);
  expect(deletion.body).toBe(null);
  expect(
    requests.some(
      ({ method, path }) =>
        method === 'DELETE' && path.startsWith('/api/spaces/'),
    ),
  ).toBe(false);
});

test('삭제 버전 충돌은 자동 재시도하지 않고 다시 확인하도록 한다', async ({
  page,
}) => {
  const state = await workspace(page, {
    userId: 'leader',
    initialDeletion: readyDeletion(),
  });
  await openTeamSettings(page);
  await page.getByRole('button', { name: '팀 최종 삭제', exact: true }).click();
  state.setDeletionConflict();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('삭제 범위와 복구 불가를 확인했습니다.').check();
  await dialog.getByRole('button', { name: '완전히 삭제' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    '동의 현황이 변경되었습니다.',
  );
  await expect(
    dialog.getByRole('button', { name: '완전히 삭제' }),
  ).toBeDisabled();
  expect(
    state.requests.filter(
      ({ method, path }) => method === 'DELETE' && path === '/api/teams/1',
    ),
  ).toHaveLength(1);
});

test('일반 팀원 탈퇴는 후임 없이 요청하고 스페이스에 머무른다', async ({
  page,
}) => {
  const { requests } = await workspace(page);
  await openTeamSettings(page);
  await page.getByRole('button', { name: '팀 탈퇴하기' }).click();
  await expect(page.getByLabel('다음 리더', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '탈퇴 확정' }).click();
  await expect(
    page.getByRole('heading', { name: '프로젝트 스페이스', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '팀 열기', exact: true }),
  ).toHaveCount(0);
  const leave = requests.find(({ path }) => path === '/api/teams/1/members/me');
  expect(leave.query).toBe('');
  await expect(page).toHaveURL(/\/spaces\/1$/);
  expect(leave.body).toBe(null);
});

test('리더 탈퇴는 현재 팀원 중 후임을 반드시 선택한다', async ({ page }) => {
  const { requests } = await workspace(page, { userId: 'leader' });
  await openTeamSettings(page);
  await page.getByRole('button', { name: '팀 탈퇴하기' }).click();
  await expect(page.getByRole('button', { name: '탈퇴 확정' })).toBeDisabled();
  await page.getByLabel('다음 리더', { exact: true }).selectOption('member');
  await page.getByRole('button', { name: '탈퇴 확정' }).click();
  await expect(
    page.getByRole('heading', { name: '프로젝트 스페이스', exact: true }),
  ).toBeVisible();
  expect(
    requests.find(({ path }) => path === '/api/teams/1/members/me').query,
  ).toBe('?nextLeaderId=member');
});

test('탈퇴에 남은 의존성이 있으면 담당 작업과 자료 정리를 안내한다', async ({
  page,
}) => {
  const { requests } = await workspace(page, { leaveBlocked: true });
  await openTeamSettings(page);
  await page.getByRole('button', { name: '팀 탈퇴하기' }).click();
  await page.getByRole('button', { name: '탈퇴 확정' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '담당 작업·승인 요청·공용 산출물',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '취소', exact: true })
    .click();
  await page.getByRole('button', { name: '담당 작업 확인' }).click();
  await expect(
    page.getByRole('heading', { name: '작업 보드', exact: true }),
  ).toBeVisible();
  expect(
    requests.filter(({ path }) => path === '/api/teams/1/members/me'),
  ).toHaveLength(1);
});

test('마지막 팀원은 탈퇴 대신 삭제 요청과 본인 동의로 팀을 삭제한다', async ({
  page,
}) => {
  await workspace(page, { userId: 'leader', memberCount: 1 });
  await openTeamSettings(page);
  await expect(
    page.getByRole('button', { name: '팀 탈퇴하기' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '팀 삭제 요청 만들기', exact: true })
    .click();
  await page.getByRole('button', { name: '삭제 요청 생성' }).click();
  await page
    .getByRole('button', { name: '팀 삭제에 동의', exact: true })
    .click();
  await expect(page.getByText('1 / 1명 동의', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '팀 최종 삭제' }),
  ).toBeEnabled();
});

test('팀 구성 고정 중에는 삭제·탈퇴·동의를 막되 반대는 허용한다', async ({
  page,
}) => {
  await workspace(page, {
    userId: 'leader',
    membershipLocked: true,
    initialDeletion: deletionRequest(),
  });
  await openTeamSettings(page);
  await expect(
    page.getByRole('button', { name: '팀 삭제에 동의', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '팀 탈퇴하기' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '팀 최종 삭제' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '삭제 반대 및 요청 취소' }).click();
  await page
    .getByRole('button', { name: '반대 및 요청 취소', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '새 삭제 요청 만들기' }),
  ).toBeDisabled();
});

test('삭제 동의 중에는 작업·수행 설명·자료를 변경할 수 없다', async ({
  page,
}) => {
  await workspace(page, { initialDeletion: deletionRequest() });
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 작업 만들기', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await expect(page.getByLabel('내 수행 설명')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '수행 설명 저장' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '할 일로 되돌리기' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '산출물 관리', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toHaveCount(0);
});

test('삭제 동의 중에는 승인·반려를 막고 관리자에게는 팀 설정을 제공하지 않는다', async ({
  page,
}) => {
  const state = await workspace(page, {
    userId: 'leader',
    initialDeletion: deletionRequest(),
  });
  state.setPending();
  await page.getByRole('button', { name: '승인 검토', exact: true }).click();
  await page.getByRole('button', { name: '작업 검토' }).click();
  await expect(page.getByRole('button', { name: '완료 승인' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '반려', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/**');
  const managerState = await workspace(page, {
    manager: true,
    userId: 'manager',
  });
  await expect(
    page.getByRole('button', { name: '팀 설정', exact: true }),
  ).toHaveCount(0);
  expect(
    managerState.requests.some(({ path }) => path.includes('deletion-request')),
  ).toBe(false);
});

test('삭제 요청 없음 외의 404는 오류로 표시하고 작업 변경을 막는다', async ({
  page,
}) => {
  await workspace(page, { deletionLoadError: 'TEAM_NOT_FOUND' });
  await openTeamSettings(page);
  await expect(page.getByRole('alert')).toContainText(
    '삭제 현황을 확인할 수 없습니다.',
  );
  await expect(
    page.getByRole('button', { name: '팀 삭제 요청 만들기', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 작업 만들기', exact: true }),
  ).toBeDisabled();
});

test('다른 팀원의 삭제 요청을 확인하면 이미 열린 작업 수정 창의 저장도 막는다', async ({
  page,
}) => {
  const state = await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await page.getByRole('button', { name: '작업 수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목').fill('아직 저장하지 않은 제목');
  state.setDeletion(deletionRequest());
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    dialog.getByRole('button', { name: '저장', exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel('작업 제목')).toHaveValue(
    '아직 저장하지 않은 제목',
  );
  await expect(
    dialog.getByText(
      '현재 팀 상태로는 작업을 저장할 수 없습니다. 창을 닫고 팀 상태를 확인해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    state.requests.filter(
      ({ method, path }) => method === 'PATCH' && path === '/api/tasks/10',
    ),
  ).toHaveLength(0);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '버리고 닫기', exact: true }).click();
  await page.getByRole('button', { name: '팀 설정', exact: true }).click();
  await expect(page.getByText('0 / 2명 동의', { exact: true })).toBeVisible();
});

const workspaceRoutes = [
  ['/spaces/1', '프로젝트 스페이스'],
  ['/spaces/1/teams/1', '삼위일체 팀'],
  ['/spaces/1/teams/1/tasks', '작업 보드'],
  ['/spaces/1/teams/1/tasks/10', '회원 탈퇴 구현'],
  ['/spaces/1/teams/1/deliverables', '산출물 관리'],
  ['/spaces/1/teams/1/approvals', '승인 검토'],
  ['/spaces/1/teams/1/approvals/tasks/10', '회원 탈퇴 구현'],
  ['/spaces/1/teams/1/members', '팀원 관리'],
  ['/spaces/1/teams/1/settings', '팀 설정'],
];
for (const [path, heading] of workspaceRoutes) {
  test(`${heading} 화면은 직접 주소로 접속하고 새로고침해도 유지된다 (${path})`, async ({
    page,
  }) => {
    await workspace(page);
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

test('팀 메뉴와 작업 상세는 브라우저 뒤로가기·앞으로가기로 복원된다', async ({
  page,
}) => {
  await workspace(page);
  await expect(page).toHaveURL(/\/spaces\/1\/teams\/1$/);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks\/10$/);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: '작업 보드', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: '삼위일체 팀', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: '작업 보드', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: '회원 탈퇴 구현', exact: true }),
  ).toBeVisible();
});

test('작업 보드의 상태·내 작업 필터는 새로고침과 상세 복귀 후 유지된다', async ({
  page,
}) => {
  await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page.getByLabel('작업 상태', { exact: true }).selectOption('IN_PROGRESS');
  await page.getByLabel('내 담당 작업만').check();
  await page.reload();
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('IN_PROGRESS');
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  await page
    .getByRole('button', { name: '회원 탈퇴 구현', exact: true })
    .click();
  await page.reload();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('IN_PROGRESS');
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  expect(new URL(page.url()).searchParams.get('mine')).toBe('1');
});

test('승인 상태 필터와 산출물 작업 범위·페이지는 주소에서 복원된다', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/spaces/1/teams/1/approvals?status=REJECTED');
  await expect(page.getByRole('main').getByRole('combobox')).toHaveValue('REJECTED');
  await page.reload();
  await expect(page.getByRole('main').getByRole('combobox')).toHaveValue('REJECTED');
  await page.goto('/spaces/1/teams/1/deliverables?taskId=10&page=2');
  await expect(page.getByLabel('작업별 조회')).toHaveValue('10');
  await expect(page.getByText('3 페이지', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('작업별 조회')).toHaveValue('10');
  await expect(page.getByText('3 페이지', { exact: true })).toBeVisible();
  await page.getByLabel('작업별 조회').selectOption('ALL');
  await expect(page.getByText('1 페이지', { exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});

test('스페이스 관리 주소는 관리자에게만 화면을 제공한다', async ({ page }) => {
  await workspace(page);
  await page.goto('/spaces/1/settings');
  await expect(
    page.getByRole('heading', { name: '스페이스 관리 권한이 없습니다.' }),
  ).toBeVisible();
  await page.unroute('**/api/**');
  await workspace(page, { manager: true, userId: 'manager' });
  await page.goto('/spaces/1/settings');
  await expect(
    page.getByRole('heading', { name: '스페이스 관리', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '스페이스 관리', exact: true }),
  ).toBeVisible();
});

test('관리자의 직접 작업·팀 설정 주소 접근은 작업 API를 호출하지 않는다', async ({
  page,
}) => {
  const { requests } = await workspace(page, {
    manager: true,
    userId: 'manager',
  });
  for (const path of [
    '/spaces/1/teams/1/tasks/10',
    '/spaces/1/teams/1/settings',
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: '이 팀 화면에 접근할 수 없습니다.' }),
    ).toBeVisible();
  }
  expect(
    requests.some(
      ({ path }) =>
        path === '/api/tasks/10' ||
        path === '/api/teams/1/tasks' ||
        path.includes('deletion-request'),
    ),
  ).toBe(false);
});

test('잘못된 주소·ID와 존재하지 않는 팀은 오류 화면으로 처리한다', async ({
  page,
}) => {
  const { requests } = await workspace(page);
  for (const path of [
    '/unknown-page',
    '/spaces/abc',
    '/spaces/1/teams/0',
    '/spaces/1/teams/1/tasks/-1',
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: '화면을 찾을 수 없습니다.' }),
    ).toBeVisible();
  }
  await page.goto('/spaces/1/teams/999');
  await expect(
    page.getByRole('heading', { name: '팀을 열 수 없습니다.' }),
  ).toBeVisible();
  expect(
    requests.some(({ path }) => /\/api\/.*(abc|NaN|\/0|\/-1)/.test(path)),
  ).toBe(false);
});

test('작업의 실제 팀이 URL의 팀과 다르면 상세와 변경 기능을 제공하지 않는다', async ({
  page,
}) => {
  const state = await workspace(page);
  state.setTaskTeamId(2);
  await page.goto('/spaces/1/teams/1/tasks/10');
  await expect(page.getByRole('alert')).toContainText(
    '이 팀에 속한 작업이 아닙니다.',
  );
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toHaveCount(0);
});

test('세션 만료 후 로그인하면 요청한 상세 URL과 필터로 복귀한다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: ({ callback }) => ({
            requestCode: () => callback({ code: 'test-google-code' }),
          }),
        },
      },
    };
  });
  const state = await workspace(page);
  state.expire();
  await page.goto('/spaces/1/teams/1/tasks/10?status=IN_PROGRESS&mine=1');
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  state.renew();
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(
    page.getByRole('heading', { name: '회원 탈퇴 구현', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/spaces/1/teams/1/tasks/10');
  expect(new URL(page.url()).searchParams.get('mine')).toBe('1');
});

test('로그아웃 후 브라우저 뒤로가기로 보호된 화면이 복원되지 않는다', async ({
  page,
}) => {
  await workspace(page);
  await page.getByRole('button', { name: '팀 설정', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '삼위일체 팀', exact: true }),
  ).toHaveCount(0);
});

for (const failureCode of ['JOIN_CODE_ALREADY_EXISTS', 'FORBIDDEN'])
  test(`참여 코드 발급은 ${failureCode === 'JOIN_CODE_ALREADY_EXISTS' ? '만료 코드 충돌만 재발급' : '권한 오류에서 재발급하지 않음'}`, async ({ page }) => {
    await workspace(page, { manager: true, userId: 'manager' });
    let issued = false;
    const operations = [];
    await page.route('**/api/spaces/1/join-code', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: issued ? 200 : 404, json: issued ? { code: 'F1E2D3C4', createdAt: '2026-10-07T10:00:00+09:00', expiresAt: '2026-10-10T10:00:00+09:00' } : { code: 'JOIN_CODE_NOT_FOUND' } });
      }
      operations.push({ path: 'create', body: route.request().postDataJSON() });
      return route.fulfill({ status: failureCode === 'FORBIDDEN' ? 403 : 409, json: { code: failureCode, message: failureCode === 'FORBIDDEN' ? '관리 권한이 없습니다.' : '이미 발급된 코드가 있습니다.' } });
    });
    await page.route('**/api/spaces/1/join-code/rotate', async (route) => {
      issued = true;
      operations.push({ path: 'rotate', body: route.request().postDataJSON() });
      return route.fulfill({ status: 200, json: { code: 'F1E2D3C4' } });
    });
    await page.goto('/spaces/1/settings');
    await page.getByLabel('코드 유효 기간', { exact: true }).selectOption('4320');
    await page.getByRole('button', { name: '참여 코드 발급', exact: true }).click();
    if (failureCode === 'JOIN_CODE_ALREADY_EXISTS') {
      await expect(page.getByText('F1E2D3C4', { exact: true })).toBeVisible();
      expect(operations).toEqual([{ path: 'create', body: { expirationMinutes: 4320 } }, { path: 'rotate', body: { expirationMinutes: 4320 } }]);
    } else {
      await expect(page.getByRole('alert')).toContainText('관리 권한이 없습니다.');
      expect(operations).toEqual([{ path: 'create', body: { expirationMinutes: 4320 } }]);
    }
  });

test('다른 작업 정보를 저장해도 미저장 수행 설명을 보존한다', async ({ page }) => {
  const state = await workspace(page);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page.getByRole('button', { name: '회원 탈퇴 구현', exact: true }).click();
  await page.getByLabel('내 수행 설명', { exact: true }).fill('아직 저장하지 않은 개인 수행 기록입니다.');
  await page.getByRole('button', { name: '작업 수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목', { exact: true }).fill('회원 탈퇴 구현 수정');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '회원 탈퇴 구현 수정', exact: true })).toBeVisible();
  await expect(page.getByLabel('내 수행 설명', { exact: true })).toHaveValue('아직 저장하지 않은 개인 수행 기록입니다.');
  expect(state.requests.some(({ method, path }) => method === 'PATCH' && path === '/api/tasks/10')).toBe(true);
});

test('빈 스페이스 목록에서 참여 코드 입력을 시작하고 코드 오류를 항목에서 확인한다', async ({ page }) => {
  const { requests } = await workspace(page);
  await page.route('**/api/spaces', (route) => route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback());
  await page.goto('/main');
  await page.getByRole('button', { name: '참여 코드 입력', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '코드로 참여' });
  await dialog.getByLabel('참여 코드', { exact: true }).fill('1234ZZZZ');
  await dialog.getByRole('button', { name: '참여', exact: true }).click();
  await expect(dialog.getByLabel('참여 코드', { exact: true })).toBeFocused();
  await expect(dialog.getByText('숫자 0–9와 영문 A–F로 된 8자리 참여 코드를 입력해 주세요.')).toBeVisible();
  expect(requests.filter(({ path, method }) => path === '/api/spaces/join' && method === 'POST')).toHaveLength(0);
});

test('빈 작업 목록은 생성 가능한 팀에만 첫 작업 등록을 제공한다', async ({ page }) => {
  await workspace(page, { memberCount: 1 });
  await page.route('**/api/teams/1/tasks', (route) => route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback());
  await page.goto('/spaces/1/teams/1/tasks');
  await expect(page.getByText('아직 등록된 작업이 없습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '첫 작업 만들기', exact: true })).toHaveCount(0);
  await expect(page.getByText('승인된 팀원이 2명 이상 모이면 작업을 만들 수 있습니다.', { exact: true })).toBeVisible();
});
