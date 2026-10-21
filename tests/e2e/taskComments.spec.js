import { koreanDateTime } from '../../src/lib/koreanTime.js';
import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

async function backend(
  page,
  { count = 0, frozen = false, status = 'DONE' } = {},
) {
  const requests = [];
  let failure = null;
  let listFailure = false;
  const members = [
    { userId: 'leader', name: '리더', role: 'LEADER' },
    { userId: 'member', name: '팀원', role: 'MEMBER' },
  ];
  const space = {
    id: 1,
    name: '댓글 스페이스',
    myRole: 'USER',
    teamBuildingStatus: 'CLOSED',
    version: 1,
  };
  const team = {
    id: 1,
    spaceId: 1,
    name: '댓글 팀',
    leaderId: 'leader',
    myMembershipStatus: 'APPROVED',
    approvedMemberCount: 2,
    canCreateTask: true,
  };
  const task = {
    id: 10,
    teamId: 1,
    title: '댓글 연결 작업',
    description: '작업 설명입니다.',
    status,
    version: 7,
    weight: 3,
    startAt: '2026-01-01T09:00:00',
    dueAt: '2026-02-01T09:00:00',
    completedAt: '2026-02-01T09:00:00',
    completionBlockReason: 'WORK_PERIOD_CLOSED',
    assignees: [{ userId: 'member', allocationPercent: 100 }],
  };
  let comments = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    taskId: 10,
    authorId: index === 0 ? 'member' : 'leader',
    authorName: index === 0 ? '팀원' : '리더',
    content: `기존 댓글 ${index + 1}`,
    createdAt: `2026-01-01T09:${String(index).padStart(2, '0')}:00`,
    updatedAt: `2026-01-01T09:${String(index).padStart(2, '0')}:00`,
  }));
  let nextId = count + 1;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (!path.startsWith('/api/')) return route.continue();
    requests.push({
      path,
      method,
      query: url.search,
      body: request.postDataJSON(),
      headers: request.headers(),
    });
    const reply = (json, responseStatus = 200) =>
      route.fulfill({ status: responseStatus, json });
    if (path === '/api/me') return reply({ id: 'leader', name: '리더' });
    if (path === '/api/auth/csrf')
      return reply({ headerName: 'X-CSRF-TOKEN', token: 'comment-token' });
    if (path === '/api/spaces') return reply([space]);
    if (path === '/api/spaces/1') return reply(space);
    if (path === '/api/spaces/1/teams') return reply([team]);
    if (path === '/api/teams/1') return reply(team);
    if (path === '/api/teams/1/members') return reply(members);
    if (path === '/api/teams/1/deletion-request')
      return frozen
        ? reply({
            id: 1,
            teamId: 1,
            status: 'PENDING',
            workFrozen: true,
            members: [],
          })
        : reply(
            {
              code: 'TEAM_DELETION_REQUEST_NOT_FOUND',
              message: '삭제 요청 없음',
            },
            404,
          );
    if (path === '/api/teams/1/tasks') return reply([task]);
    if (path === '/api/tasks/10')
      return reply({ task, contributions: [], deliverableSummary: [] });
    if (path === '/api/teams/1/deliverables') return reply([]);
    if (path === '/api/tasks/10/comments' && method === 'GET') {
      if (listFailure)
        return reply(
          { code: 'ERROR', message: '댓글 조회에 실패했습니다.' },
          500,
        );
      const offset =
        Number(url.searchParams.get('page')) *
        Number(url.searchParams.get('size'));
      return reply(
        comments.slice(offset, offset + Number(url.searchParams.get('size'))),
      );
    }
    if (path.includes('comments') && failure) {
      const error = failure;
      failure = null;
      return reply(error.body, error.status);
    }
    if (path === '/api/tasks/10/comments' && method === 'POST') {
      const comment = {
        id: nextId++,
        taskId: 10,
        authorId: 'leader',
        authorName: '리더',
        content: request.postDataJSON().content,
        createdAt: koreanDateTime(),
        updatedAt: koreanDateTime(),
      };
      comments.push(comment);
      return reply(comment, 201);
    }
    if (path.startsWith('/api/task-comments/')) {
      const id = Number(path.split('/').at(-1));
      if (method === 'DELETE') {
        comments = comments.filter((comment) => comment.id !== id);
        return route.fulfill({ status: 204 });
      }
      const comment = comments.find((comment) => comment.id === id);
      Object.assign(comment, {
        content: request.postDataJSON().content,
        updatedAt: koreanDateTime(),
      });
      return reply(comment);
    }
    return reply({ code: 'NOT_FOUND', message: path }, 404);
  });
  await page.goto('/spaces/1/teams/1/tasks/10');
  await expect(
    page.getByRole('heading', { name: '댓글 연결 작업', exact: true }),
  ).toBeVisible();
  const input = page
    .getByRole('region', { name: '작업 댓글', exact: true })
    .getByLabel('댓글 내용', { exact: true });
  if (frozen) await expect(input).toBeDisabled();
  else await expect(input).toBeEnabled();
  return {
    requests,
    failWrite: (error) => {
      failure = error;
    },
    failList: (value) => {
      listFailure = value;
    },
  };
}

test('실제 로그인 경로에서 댓글 CRUD·CSRF·일반 텍스트와 작업 불변을 확인한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { requests } = await backend(page);
  const panel = page.getByRole('region', { name: '작업 댓글', exact: true });
  await expect(panel.getByText('아직 댓글이 없습니다.')).toBeVisible();
  await panel
    .getByLabel('댓글 내용', { exact: true })
    .fill('  <b>피드백</b>\n보완 의견  ');
  await panel.getByRole('button', { name: '댓글 등록' }).click();
  await expect(
    panel.getByText('<b>피드백</b>\n보완 의견', { exact: true }),
  ).toBeVisible();
  await expect(panel.locator('.task-comment-content b')).toHaveCount(0);
  await expect(panel.getByLabel('댓글 내용', { exact: true })).toHaveValue('');
  await panel.getByRole('button', { name: '수정', exact: true }).click();
  await panel.getByLabel('댓글 수정 내용').fill('수정한 의견');
  await panel.getByRole('button', { name: '수정 저장' }).click();
  await expect(panel.getByText('수정한 의견', { exact: true })).toBeVisible();
  await expect(panel.getByText('· 수정됨', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('comments-desktop.png'),
    fullPage: true,
  });
  await panel.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('dialog', { name: '댓글 삭제', exact: true })
    .getByRole('button', { name: '댓글 삭제', exact: true })
    .click();
  await expect(panel.getByText('아직 댓글이 없습니다.')).toBeVisible();
  const writes = requests.filter((request) => request.method !== 'GET');
  expect(writes.map(({ method }) => method)).toEqual([
    'POST',
    'PATCH',
    'DELETE',
  ]);
  for (const request of writes)
    expect(request.headers['x-csrf-token']).toBe('comment-token');
  expect(writes[0].body).toEqual({ content: '<b>피드백</b>\n보완 의견' });
  expect(writes[1].body).toEqual({ content: '수정한 의견' });
  expect(
    requests.filter(
      ({ path, method }) => path === '/api/tasks/10' && method !== 'GET',
    ),
  ).toEqual([]);
});

test('20개 페이지·작성자 버튼·마지막 페이지 삭제 후 이동을 확인한다', async ({
  page,
}) => {
  await backend(page, { count: 21 });
  const panel = page.getByRole('region', { name: '작업 댓글', exact: true });
  const items = panel.locator('.task-comment-entry');
  await expect(items).toHaveCount(20);
  await expect(
    items.first().getByRole('button', { name: '수정', exact: true }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: '다음', exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(panel.getByText('기존 댓글 21', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('dialog', { name: '댓글 삭제', exact: true })
    .getByRole('button', { name: '댓글 삭제', exact: true })
    .click();
  await expect(items).toHaveCount(20);
  await expect(panel.getByText('1 페이지', { exact: true })).toBeVisible();
});

test('쓰기 오류는 입력을 보존하고 조회 오류는 작업 상세와 분리해 재시도한다', async ({
  page,
}) => {
  const backendState = await backend(page);
  const panel = page.getByRole('region', { name: '작업 댓글', exact: true });
  backendState.failWrite({
    status: 409,
    body: {
      code: 'TEAM_DELETION_IN_PROGRESS',
      message: '팀 삭제 동의 중입니다.',
    },
  });
  await panel.getByLabel('댓글 내용', { exact: true }).fill('보존할 초안');
  await panel.getByRole('button', { name: '댓글 등록' }).click();
  await expect(panel.getByRole('alert')).toContainText('팀 삭제 동의 중');
  await expect(panel.getByLabel('댓글 내용', { exact: true })).toHaveValue(
    '보존할 초안',
  );
  expect(
    backendState.requests.filter(({ method }) => method === 'POST'),
  ).toHaveLength(1);
  await panel.getByRole('button', { name: '댓글 등록' }).click();
  await expect(panel.getByText('보존할 초안', { exact: true })).toBeVisible();
  backendState.failList(true);
  await panel.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('댓글 조회에 실패');
  await expect(
    page.getByRole('heading', { name: '댓글 연결 작업', exact: true }),
  ).toBeVisible();
  backendState.failList(false);
  await panel
    .getByRole('button', { name: '다시 불러오기', exact: true })
    .click();
  await expect(panel.getByText('보존할 초안', { exact: true })).toBeVisible();
});

test('삭제 동결에서는 기존 댓글을 읽고 댓글 쓰기 버튼은 비활성화한다', async ({
  page,
}) => {
  const { requests } = await backend(page, { count: 2, frozen: true });
  const panel = page.getByRole('region', { name: '작업 댓글', exact: true });
  await expect(panel.getByText('기존 댓글 1', { exact: true })).toBeVisible();
  await expect(
    panel.getByRole('button', { name: '수정', exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole('button', { name: '삭제', exact: true }),
  ).toBeDisabled();
  await expect(panel.getByLabel('댓글 내용', { exact: true })).toBeDisabled();
  expect(requests.filter(({ method }) => method !== 'GET')).toHaveLength(0);
});

for (const width of [390, 1440])
  test(`미리보기 ${width}px에서 마감된 완료 작업의 비담당 팀원이 댓글을 작성한다`, async ({
    page,
  }, testInfo) => {
    const state = structuredClone(getMockState(previewContext()));
    state.rounds.find((round) => round.type === 'FINAL').closesAt =
      '2020-01-01T09:00:00';
    await page.addInitScript((state) => {
      localStorage.setItem('fairplay:preview-role', 'teammate');
      if (!localStorage.getItem('fairplay:mock:v7:preview:1'))
        localStorage.setItem(
          'fairplay:mock:v7:preview:1',
          JSON.stringify(state),
        );
    }, state);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1/teams/1/tasks/101');
    const panel = page.getByRole('region', { name: '작업 댓글', exact: true });
    await panel
      .getByLabel('댓글 내용', { exact: true })
      .fill('최종 마감 후에도 의견을 남깁니다.');
    await panel.getByRole('button', { name: '댓글 등록' }).click();
    await expect(
      panel.getByText('최종 마감 후에도 의견을 남깁니다.', { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText('박서연 · 나', { exact: true })).toBeVisible();
    const assignment = page.getByRole('region', {
      name: '담당자와 배분',
      exact: true,
    });
    expect((await panel.boundingBox()).y).toBeGreaterThan(
      (await assignment.boundingBox()).y,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width < 600)
      expect((await panel.boundingBox()).width).toBeGreaterThan(width - 80);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`comments-${width}.png`),
      fullPage: true,
    });
    await panel.screenshot({
      path: testInfo.outputPath(`comment-panel-${width}.png`),
    });
    await page.reload();
    await expect(
      panel.getByText('최종 마감 후에도 의견을 남깁니다.', { exact: true }),
    ).toBeVisible();
  });
