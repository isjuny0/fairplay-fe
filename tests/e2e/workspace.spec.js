import { expect, test } from '@playwright/test';

const members = [
  { userId: 'leader', name: '리더', isLeader: true, isDeputy: false },
  { userId: 'member', name: '담당자', isLeader: false, isDeputy: false },
];

async function workspace(
  page,
  { userId = 'member', manager = false, memberCount = 2 } = {},
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
    if (path === '/api/spaces/1/teams') return respond([team]);
    if (path === '/api/teams/1') return respond(team);
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
    setConflict: () => {
      conflict = true;
    },
    expire: () => {
      expired = true;
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
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '완료 승인', exact: true }).click();
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
  await page.getByLabel('유효 기간 (분)').fill('60');
  await page.getByRole('button', { name: '최초 발급', exact: true }).click();
  await expect(page.getByText('A1B2C3D4', { exact: true })).toBeVisible();
  expect(
    JSON.parse(
      requests.find(
        ({ path, method }) => path.endsWith('/join-code') && method === 'POST',
      ).body,
    ),
  ).toEqual({ expirationMinutes: 60 });
  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: '철회', exact: true }).click();
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
