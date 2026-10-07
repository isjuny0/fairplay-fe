import { test, expect } from '@playwright/test';

async function preview(
  page,
  { role = 'leader', scenario = 'active', path = '/spaces/1/teams/1' } = {},
) {
  const apiCalls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  await page.goto('/preview/main');
  await page.getByLabel('미리보기 역할').selectOption(role);
  if (scenario !== 'active')
    await page.getByLabel('미리보기 상황').selectOption(scenario);
  await page.goto(`/preview${path}`);
  await expect(page.getByLabel('미리보기 역할')).toHaveValue(role);
  return apiCalls;
}

for (const [path, heading, role] of [
  ['/main', '내 스페이스', 'leader'],
  ['/spaces/1', '2026 서비스 디자인 프로젝트', 'leader'],
  ['/spaces/1/teams/1', '삼위일체', 'leader'],
  ['/spaces/1/teams/1/tasks', '작업 보드', 'leader'],
  ['/spaces/1/teams/1/tasks/101', '사용자 인터뷰 계획', 'leader'],
  ['/spaces/1/teams/1/deliverables', '산출물 관리', 'leader'],
  ['/spaces/1/teams/1/approvals', '승인 검토', 'reviewer'],
  ['/spaces/1/teams/1/members', '팀원 관리', 'leader'],
  ['/spaces/1/teams/1/settings', '팀 설정', 'leader'],
  ['/spaces/1/teams/1/peer-evaluations', '동료 평가', 'leader'],
  ['/spaces/1/teams/1/mid-feedback', '중간 피드백', 'leader'],
  ['/spaces/1/teams/1/reports', '기여도 리포트', 'leader'],
  ['/spaces/1/dashboard', '관리자 대시보드', 'manager'],
  ['/spaces/1/rounds', '평가 회차 관리', 'manager'],
  ['/spaces/1/reports', '리포트 검토·공개', 'manager'],
  ['/spaces/1/settings', '스페이스 관리', 'manager'],
  [
    '/spaces/1/manager/teams/1/members/00000000-0000-4000-8000-000000000001',
    '김하늘님의 수행 상세',
    'manager',
  ],
])
  test(`미리보기 ${heading} 화면은 서버 요청 없이 열린다`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const calls = await preview(page, { path, role });
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    expect(calls).toEqual([]);
    expect(errors).toEqual([]);
  });

test('팀 홈과 관리자 현황은 가중치 숫자 대신 비율과 계산 기준을 보여준다', async ({ page }) => {
  await preview(page);
  await expect(page.getByText('완료 가중치', { exact: false })).toHaveCount(0);
  await expect(page.getByText('예상 작업량을 반영한 진행률입니다.', { exact: false })).toBeVisible();
  await page.getByLabel('미리보기 역할').selectOption('manager');
  await page.goto('/preview/spaces/1/dashboard');
  await expect(page.getByRole('columnheader', { name: '현재 팀원 완료 비중' })).toHaveCount(2);
  await expect(page.getByRole('columnheader', { name: '승인된 배분 가중치' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '김하늘', exact: true }) }))
    .toContainText('80.00%');
  await page.evaluate(() => {
    const key = 'fairplay:mock:v1:preview:1';
    const state = JSON.parse(localStorage.getItem(key));
    for (const team of Object.values(state.teams))
      for (const task of team.tasks) task.status = 'TODO';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole('cell', { name: '완료 작업 없음', exact: true })).toHaveCount(5);
});

test('대상별 평가를 저장하고 제출하면 새로고침 후에도 수정이 잠긴다', async ({
  page,
}) => {
  const calls = await preview(page, {
    path: '/spaces/1/teams/1/peer-evaluations',
  });
  for (const member of ['이지원', '박서연']) {
    for (const criterion of ['작업 수행', '책임감', '협업', '의사소통'])
      await page
        .getByLabel(`${member} ${criterion} 4점`, { exact: true })
        .check();
    await page
      .getByRole('button', { name: `${member} 평가 저장`, exact: true })
      .click();
  }
  await page.getByRole('button', { name: '최종 제출', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '제출 확정', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '최종 제출 완료' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel('이지원 작업 수행 4점', { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel('이지원 작업 수행 4점', { exact: true }),
  ).toBeDisabled();
  expect(calls).toEqual([]);
});
test('저점 사유 누락을 안내하고 공개 전 리포트는 팀원에게 보이지 않는다', async ({
  page,
}) => {
  await preview(page, { path: '/spaces/1/teams/1/peer-evaluations' });
  for (const criterion of ['작업 수행', '책임감', '협업', '의사소통'])
    await page.getByLabel(`이지원 ${criterion} 2점`, { exact: true }).check();
  await page
    .getByRole('button', { name: '이지원 평가 저장', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('10~500자');
  await page.getByLabel('미리보기 상황').selectOption('review');
  await page.goto('/preview/spaces/1/teams/1/reports');
  await expect(
    page.getByRole('heading', { name: '공개된 리포트가 없습니다.' }),
  ).toBeVisible();
});
test('관리자가 리포트를 공개하면 팀원은 본인 계산 근거를 볼 수 있다', async ({
  page,
}) => {
  const calls = await preview(page, {
    role: 'manager',
    scenario: 'review',
    path: '/spaces/1/reports',
  });
  await page.getByRole('button', { name: '초안 생성', exact: true }).click();
  await page.getByRole('button', { name: '리포트 공개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '공개 확정' })
    .click();
  await expect(
    page.getByText('공개된 최종 결과', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '나의 계산 근거' }),
  ).toHaveCount(0);
  await page.getByLabel('미리보기 역할').selectOption('member');
  await page.goto('/preview/spaces/1/teams/1/reports');
  await expect(
    page.getByRole('heading', { name: '나의 계산 근거' }),
  ).toBeVisible();
  await expect(page.getByText('이지원 · 나', { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});
test('AI 기술 실패 재시도와 자료 보완 권한을 구분한다', async ({ page }) => {
  await preview(page, { role: 'member', path: '/spaces/1/teams/1/tasks/106' });
  await expect(page.getByText('점수 없음', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'AI 평가 다시 시도' }).click();
  await expect(page.getByText('평가 대기', { exact: true })).toBeVisible();
  await page.getByLabel('미리보기 역할').selectOption('reviewer');
  await page.goto('/preview/spaces/1/teams/1/tasks/105');
  await page.getByRole('button', { name: '자료 보완 허용' }).click();
  await expect(
    page.getByText('진행 중', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '자료 보완 허용' }),
  ).toHaveCount(0);
});
test('팀원 직접 관리자 주소 접근은 차단하고 관리자는 수행 자료를 읽고 다운로드한다', async ({
  page,
}) => {
  await preview(page, { path: '/spaces/1/dashboard' });
  await expect(
    page.getByRole('heading', { name: '스페이스 관리 권한이 없습니다.' }),
  ).toBeVisible();
  await page.getByLabel('미리보기 역할').selectOption('manager');
  await page.goto('/preview/spaces/1/dashboard');
  await page.getByRole('button', { name: '김하늘 수행 상세' }).click();
  await page.getByText('인터뷰 결과 기록 파일 · FILE', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '예시 파일 다운로드' }).click();
  expect((await downloaded).suggestedFilename()).toBe('인터뷰-기록.txt');
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
});
test('미리보기 업로드는 새 파일 형식을 지원하고 URL 새 등록은 제공하지 않는다', async ({
  page,
}) => {
  const calls = await preview(page, { path: '/spaces/1/teams/1/deliverables' });
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목', { exact: true }).fill('발표 자료');
  await dialog.getByLabel('분류', { exact: true }).selectOption('PRESENTATION');
  await expect(dialog.getByLabel('자료 유형').locator('option')).toHaveText([
    'TEXT',
    'FILE',
  ]);
  await dialog.getByLabel('자료 유형').selectOption('FILE');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: '발표.pptx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: Buffer.from('preview only'),
  });
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('발표.pptx ·', { exact: false })).toBeVisible();
  expect(calls).toEqual([]);
});
test('평가 시작 전 회차 생성·일정 수정·개방 화면을 사용할 수 있다', async ({
  page,
}) => {
  await preview(page, {
    role: 'manager',
    scenario: 'setup',
    path: '/spaces/1/rounds',
  });
  await page.getByRole('button', { name: '평가 회차 만들기' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '중간 평가 일정 수정' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '중간 평가 시작' }).click();
  await expect(
    page.getByRole('button', { name: '중간 평가 마감' }),
  ).toBeVisible();
});

test('로그인 미리보기는 Google 요청 없이 화면 미리보기로 이동한다', async ({
  page,
}) => {
  const calls = await preview(page, { path: '/main' });
  await page.goto('/preview/login');
  await expect(
    page.getByRole('heading', { name: 'Fairplay', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Google 로그인 · 실제 서비스에서 연결' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '로그인 없이 화면 미리보기' }).click();
  await expect(
    page.getByRole('heading', { name: '내 스페이스', exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('실제 로그인 화면에서 인증 없이 미리보기를 시작할 수 있다', async ({
  page,
}) => {
  const apiCalls = [];
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"code":"UNAUTHORIZED"}',
    }),
  );
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  const initialCalls = apiCalls.length;
  await page.getByRole('button', { name: '로그인 없이 화면 미리보기' }).click();
  await expect(
    page.getByRole('heading', { name: '내 스페이스', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/preview\/main$/);
  expect(apiCalls.length).toBe(initialCalls);
});

test('자료 보완 후 새 완료 요청을 승인하면 새 AI 결과와 이전 승인 이력이 보인다', async ({
  page,
}) => {
  const calls = await preview(page, {
    role: 'reviewer',
    path: '/spaces/1/teams/1/tasks/105',
  });
  await page.getByRole('button', { name: '자료 보완 허용' }).click();
  await page.getByLabel('미리보기 역할').selectOption('leader');
  await page.goto('/preview/spaces/1/teams/1/tasks/105');
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목', { exact: true }).fill('발표 자료 보완 기록');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('조사 결과와 근거를 보완하여 발표 내용을 다시 정리했습니다.');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByText('발표 자료 보완 기록', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '완료 요청', exact: true }).click();
  await page.getByLabel('미리보기 역할').selectOption('reviewer');
  await page.goto('/preview/spaces/1/teams/1/approvals/tasks/105');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '완료 승인', exact: true }).click();
  await expect(page.getByText('85 / 100', { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});
test('팀 빌딩 상황에서는 가입 승인 및 미가입 참여자의 팀 생성 화면을 제공한다', async ({
  page,
}) => {
  await preview(page, {
    scenario: 'building',
    path: '/spaces/1/teams/1/members',
  });
  await expect(page.getByText('한지민', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '가입 승인', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '승인된 팀원 · 4명' }),
  ).toBeVisible();
  await page.getByLabel('미리보기 상황').selectOption('building');
  await page.getByLabel('미리보기 역할').selectOption('participant');
  await page.goto('/preview/spaces/1');
  await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
for (const width of [320, 768, 1440])
  test(`${width}px에서 팀·평가·관리자 화면이 가로로 넘치지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await preview(page);
    for (const path of [
      '/spaces/1/teams/1',
      '/spaces/1/teams/1/peer-evaluations',
      '/spaces/1/teams/1/reports',
    ]) {
      await page.goto(`/preview${path}`);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByLabel('미리보기 역할').selectOption('manager');
    await page.goto('/preview/spaces/1/dashboard');
    await expect(
      page.getByRole('heading', { name: '관리자 대시보드', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
