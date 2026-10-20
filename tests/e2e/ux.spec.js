import { fillDateTime } from './helpers/dateTime.js';
import { test, expect } from '@playwright/test';

async function selectWorkspaceOption(page, label, value) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page
    .getByRole('listbox', { name: label, exact: true })
    .locator(`[role="option"][data-value="${value}"]`)
    .click();
}

async function openPreview(page, path, role = 'leader', scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByText('미리보기 설정', { exact: true }).click();
  await page.getByLabel('미리보기 역할').selectOption(role);
  if (scenario !== 'active')
    await page.getByLabel('미리보기 상황').selectOption(scenario);
  await page.goto(`/preview${path}`);
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
}

async function fillEvaluation(page, member, score = 4) {
  if (
    !(await page
      .getByLabel(`${member} 작업 수행 ${score}점`, { exact: true })
      .isVisible())
  )
    await page
      .getByRole('group', { name: '평가할 팀원 선택', exact: true })
      .getByRole('button', { name: new RegExp(`^${member}`) })
      .click();
  for (const criterion of ['작업 수행', '책임감', '협업', '의사소통'])
    await page
      .getByLabel(`${member} ${criterion} ${score}점`, { exact: true })
      .check();
}

const peerPath = '/spaces/1/teams/1/peer-evaluations';

test('저장 후 바꾼 평가는 제출을 막고 다시 저장한 최신 점수만 제출한다', async ({
  page,
}) => {
  await openPreview(page, peerPath);
  for (const member of ['이지원', '박서연']) {
    await fillEvaluation(page, member);
    await page
      .getByRole('button', { name: `${member} 평가 저장`, exact: true })
      .click();
  }
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '이지원 저장됨', exact: true })
    .click();
  await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
  await expect(page.getByText('미저장 변경', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '이지원 평가 저장', exact: true })
    .click();
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
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeDisabled();
});

test('미저장 평가의 메뉴 이동과 브라우저 뒤로가기를 취소하면 입력을 유지한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  await page.getByRole('button', { name: '동료 평가', exact: true }).click();
  await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
  await page.getByRole('button', { name: '작업', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('저장하지 않은 입력');
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeChecked();
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('저장하지 않은 입력');
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page).toHaveURL(/peer-evaluations$/);
  await page
    .getByRole('button', { name: '중간 평가 마감', exact: true })
    .click();
  await page
    .getByRole('button', { name: '변경 사항 버리고 이동', exact: true })
    .click();
  await expect(page).toHaveURL(/roundId=11$/);
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeDisabled();
});

test('작업 입력창의 Escape와 취소는 미저장 내용을 확인하고 입력을 보존한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const taskDialog = page.getByRole('dialog', { name: '새 작업 만들기' });
  await taskDialog
    .getByLabel('작업 제목', { exact: true })
    .fill('입력 보존 확인');
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: '입력 내용 버리기' })
    .getByRole('button', { name: '취소', exact: true })
    .click();
  await expect(taskDialog.getByLabel('작업 제목', { exact: true })).toHaveValue(
    '입력 보존 확인',
  );
  await taskDialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '버리고 닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [1440, 390])
  test(`평가 대상 전환 ${width}px: 다른 대상 저장에도 미저장 점수를 보존한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openPreview(page, '/spaces/1/teams/1');
    if (width < 721) {
      await expect(page.getByLabel('미리보기 역할')).toBeHidden();
      await expect(
        page.getByRole('navigation', { name: '팀 메뉴', exact: true }),
      ).toBeHidden();
      await page.getByText('더보기 ⌄', { exact: true }).click();
    }
    await page.getByRole('button', { name: '동료 평가', exact: true }).click();
    await fillEvaluation(page, '이지원');
    await page
      .getByRole('button', { name: '이지원 평가 저장', exact: true })
      .click();
    await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
    await page
      .getByRole('button', { name: '박서연 작성 필요', exact: true })
      .click();
    await fillEvaluation(page, '박서연');
    await page
      .getByRole('button', { name: '박서연 평가 저장', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '최종 제출', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: '이지원 미저장', exact: true })
      .click();
    await expect(
      page.getByLabel('이지원 작업 수행 5점', { exact: true }),
    ).toBeChecked();
    await page
      .getByRole('button', { name: '이지원 평가 저장', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '최종 제출', exact: true }),
    ).toBeEnabled();
  });

for (const height of [844, 500])
  test(`390×${height} 작업 입력창은 스크롤 전후 저장 버튼과 입력 초점이 가려지지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height });
    await openPreview(page, '/spaces/1/teams/1/tasks');
    await page
      .getByRole('button', { name: '새 작업 만들기', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    const next = dialog.getByRole('button', {
      name: '다음: 담당·배분',
      exact: true,
    });
    const initialBox = await next.boundingBox();
    expect(initialBox.y + initialBox.height).toBeLessThanOrEqual(height);
    await dialog
      .getByLabel('작업 제목', { exact: true })
      .fill('입력 영역 확인');
    await dialog
      .getByLabel('작업 설명', { exact: true })
      .fill('키보드가 열린 높이에서도 다음 행동을 확인합니다.');
    await fillDateTime(dialog, '마감', '2030-12-01T18:00');
    await next.click();


    const inputBox = await dialog
      .getByRole('button', {name:'균등 배분',exact:true})
      .boundingBox();
    const nextBox = await dialog
      .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
      .boundingBox();
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(nextBox.y);
    expect(nextBox.y + nextBox.height).toBeLessThanOrEqual(height);
  });

test('세 담당자 균등 배분으로 작업을 생성한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목', { exact: true }).fill('균등 배분 작업');
  await dialog
    .getByLabel('작업 설명', { exact: true })
    .fill('모든 담당자의 역할과 결과를 함께 확인합니다.');
  await fillDateTime(dialog, '마감', '2030-12-01T18:00');
  for (const member of ['김하늘 · 리더', '이지원 · 팀원', '박서연 · 팀원'])
    await dialog.getByLabel(member, { exact: true }).check();
  await dialog.getByRole('button', { name: '균등 배분', exact: true }).click();
  await expect(dialog.getByText('담당 3명', { exact: true })).toBeVisible();
  await expect(dialog.getByText('합계 100%', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('김하늘 배분율')).toHaveValue('34');
  await expect(dialog.getByLabel('이지원 배분율')).toHaveValue('33');
  await expect(dialog.getByLabel('박서연 배분율')).toHaveValue('33');


  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '균등 배분 작업', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('모바일 관리자 카드는 표 가로 스크롤 없이 수행 상세를 연다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, '/spaces/1/dashboard', 'manager');
  await page.getByLabel('조회할 팀').selectOption('1');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page
    .getByRole('button', { name: '김하늘 수행 상세', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '김하늘님의 수행 상세', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('조회할 작업 상태').selectOption('REVISING');
  await expect(
    page.getByRole('heading', { name: '서비스 흐름 설계', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '사용자 인터뷰 계획', exact: true }),
  ).toHaveCount(0);
});

test('데스크톱 팀 메뉴는 왼쪽에 묶이고 메뉴 이동과 새로고침에서 현재 위치를 유지한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  const sidebar = page.getByRole('navigation', {
    name: '스페이스 메뉴',
    exact: true,
  });
  const teamMenus = sidebar.getByRole('navigation', {
    name: '팀 메뉴',
    exact: true,
  });
  await expect(teamMenus.getByRole('button')).toHaveCount(8);
  await expect(
    teamMenus.getByRole('paragraph').filter({ hasText: /^팀 작업$/ }),
  ).toBeVisible();
  await expect(
    teamMenus.getByText('평가·리포트', { exact: true }),
  ).toBeVisible();
  await expect(teamMenus.getByText('팀 관리', { exact: true })).toBeVisible();
  await expect(page.locator('.tab-bar')).toHaveCount(0);
  await teamMenus.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(page).toHaveURL(/teams\/1\/deliverables$/);
  await page.reload();
  await expect(
    page.getByRole('navigation', { name: '현재 위치' }),
  ).toContainText(/삼위일체\s*\/\s*산출물/);
  await expect(
    teamMenus.getByRole('button', { name: '산출물', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('스페이스 선택은 현재 공간을 전환하고 뒤로가기로 이전 공간을 복원한다', async ({
  page,
}) => {
  await openPreview(page, '/main');
  await page
    .getByRole('main').getByRole('button', { name: '새 스페이스', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('스페이스 이름', { exact: true })
    .fill('두 번째 프로젝트');
  await fillDateTime(dialog, '프로젝트 시작', '2030-01-01T09:00');
  await fillDateTime(dialog, '프로젝트 종료', '2030-12-31T18:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(/spaces\/3$/);
  await expect(
    page.getByRole('heading', { name: '두 번째 프로젝트', exact: true }),
  ).toBeVisible();
  await selectWorkspaceOption(page, '스페이스 선택', '1');
  await expect(page).toHaveURL(/spaces\/1$/);
  await expect(
    page.getByRole('heading', {
      name: '2026 서비스 디자인 프로젝트',
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/spaces\/3$/);
  await expect(
    page.getByRole('heading', { name: '두 번째 프로젝트', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('스페이스 선택', { exact: true }),
  ).toHaveAttribute('data-value', '3');
});

test('관리자는 다른 팀 목록으로 자료 조회에 진입하고 팀 작업 메뉴는 제공하지 않는다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1', 'manager');
  await page.getByRole('listitem').filter({ hasText: '파도' }).getByRole('button', { name: '팀 자료 조회', exact: true }).click();
  await expect(page).toHaveURL(/teams\/2\/members$/);
  await expect(
    page.getByRole('heading', { name: '팀원 관리', exact: true }),
  ).toBeVisible();
  const sidebar = page.getByRole('navigation', {
    name: '스페이스 메뉴',
    exact: true,
  });
  await expect(
    sidebar.getByRole('button', { name: '관리자 대시보드', exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: '작업', exact: true }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole('button', { name: '승인 검토', exact: true }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole('button', { name: '팀 설정', exact: true }),
  ).toHaveCount(0);
  await sidebar.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '산출물 관리', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toHaveCount(0);
});

test('모바일 스페이스 메뉴는 하나의 접힌 영역에 있고 작업 목록은 본문 폭을 사용한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, '/spaces/1');
  await expect(page.getByLabel('팀 선택', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: /스페이스 메뉴/ }).click();
  await expect(page.getByLabel('스페이스 선택', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '내 팀 · 삼위일체', exact: true }).click();
  await expect(page).toHaveURL(/teams\/1$/);
  await expect(page.getByLabel('팀 선택', { exact: true })).toBeHidden();
  await page
    .getByRole('navigation', { name: '모바일 팀 메뉴' })
    .getByRole('button', { name: '작업', exact: true })
    .click();
  await expect(page.getByLabel('작업 상태', { exact: true })).toBeHidden();
  await expect(page.getByLabel('작업 정렬', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: /^필터/ }).click();
  await expect(page.getByLabel('작업 정렬', { exact: true })).toBeVisible();
  const columns = await page.locator('.task-columns').boundingBox();
  const card = await page.locator('.board-task-card').first().boundingBox();
  expect(card.width).toBeGreaterThanOrEqual(columns.width - 2);
  await page.getByRole('button', { name: /스페이스 메뉴/ }).click();
  await expect(
    page.getByRole('navigation', { name: '팀 메뉴', exact: true }),
  ).toBeHidden();
});

test('데스크톱 홈은 확인할 작업을 먼저 배치하고 입력·읽기 화면 폭을 유지한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await openPreview(page, '/spaces/1/teams/1');
  const action = await page
    .locator('.team-home-summary .next-action-panel')
    .boundingBox();
  const own = await page
    .getByRole('region', { name: '본인 작업 현황' })
    .boundingBox();
  const progress = await page.locator('.home-team-progress').boundingBox();
  expect(own.y).toBeGreaterThanOrEqual(action.y + action.height);
  expect(own.y).toBeGreaterThanOrEqual(progress.y + progress.height);
  expect(Math.abs(progress.y - action.y)).toBeLessThan(2);
  expect(progress.x + progress.width).toBeLessThanOrEqual(action.x);
  const wide = await page.getByRole('main').boundingBox();
  await page.getByRole('button', { name: '중간 피드백', exact: true }).click();
  const reading = await page.getByRole('main').boundingBox();
  expect(reading.width).toBe(wide.width);
  expect(reading.width).toBeGreaterThan(900);
  await page.getByRole('button', { name: '작업', exact: true }).click();
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const content = page.getByRole('region', { name: '작업 내용 입력' });
  const assignment = page.getByRole('region', { name: '담당·배분 설정 입력' });
  const contentBox = await content.boundingBox();
  const assignmentBox = await assignment.boundingBox();
  expect(assignmentBox.x).toBeGreaterThan(contentBox.x + contentBox.width);
  await page.setViewportSize({ width: 768, height: 900 });
  const stackedContent = await content.boundingBox();
  const stackedAssignment = await assignment.boundingBox();
  expect(stackedAssignment.y).toBeGreaterThanOrEqual(
    stackedContent.y + stackedContent.height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('데스크톱 작업 상세를 스크롤해도 작업 진행 버튼은 진행 영역에 남는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPreview(page, '/spaces/1/teams/1/tasks/102');
  const sidebar = page.getByRole('complementary', {
    name: '작업 진행 및 담당',
  });
  await expect(
    sidebar.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeVisible();
  // Wait for route focus/scroll restoration before measuring a manual scroll.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => window.scrollTo(0, 700));
  const navigation = await page
    .locator('.task-detail-navigation')
    .boundingBox();
  await expect
    .poll(async () => (await sidebar.boundingBox()).y)
    .toBeLessThanOrEqual(navigation.y + navigation.height + 24);
  expect((await sidebar.boundingBox()).y).toBeGreaterThanOrEqual(
    navigation.y + navigation.height,
  );
  await expect(
    sidebar.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeInViewport();
});

test('작업 제목 검색·정렬은 새로고침과 상세 복귀에도 유지되고 빈 결과에서 초기화한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page.getByLabel('작업 제목 검색').fill('설문');
  await page.getByLabel('작업 정렬').selectOption('newest');
  await expect(page.locator('.board-task-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await expect(page.getByLabel('작업 정렬')).toHaveValue('newest');
  await page
    .getByRole('button', { name: '설문 결과 분석', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await page.getByLabel('작업 제목 검색').fill('없는 작업 제목');
  await expect(
    page.getByText('조건에 맞는 작업이 없습니다.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '전체 작업 보기', exact: true })
    .click();
  await expect(page.locator('.board-task-card')).toHaveCount(6);
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('');
  await expect(page.getByLabel('작업 정렬')).toHaveValue('deadline');
  const completedTitles = page.locator('.task-state-done .task-title-button');
  await expect(completedTitles).toHaveText([
    '조사 결과 요약',
    '최종 발표 자료',
    '사용자 인터뷰 계획',
  ]);
});

test('모바일 작업 입력은 첫 오류로 초점을 옮기고 배분을 고친 뒤 저장한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '새 작업 만들기' });
  await dialog
    .getByRole('button', { name: '다음: 담당·배분', exact: true })
    .click();
  await expect(dialog.getByLabel('작업 제목', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog
    .getByLabel('작업 제목', { exact: true })
    .fill('현장 조사 일정 확정');
  await dialog
    .getByLabel('작업 설명', { exact: true })
    .fill('대상과 일정을 확정하고 조사 계획을 공유합니다.');
  await fillDateTime(dialog, '마감', '2030-12-01T18:00');
  await dialog
    .getByRole('button', { name: '다음: 담당·배분', exact: true })
    .click();
  await dialog.getByLabel('김하늘 · 리더', { exact: true }).check();
  await dialog.getByLabel('김하늘 배분율', { exact: true }).fill('90');
  await dialog
    .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
    .click();
  await expect(dialog.getByText(/현재 합계는 90%/)).toBeVisible();
  await expect(
    dialog.getByLabel('김하늘 · 리더', { exact: true }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: '균등 배분', exact: true }).click();
  await dialog
    .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
    .click();
  await expect(
    dialog.getByRole('region', { name: '작업 저장 전 요약' }),
  ).toContainText('현장 조사 일정 확정');
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await expect(dialog.getByLabel('김하늘 배분율', { exact: true })).toHaveValue(
    '100',
  );
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveValue(
    '현장 조사 일정 확정',
  );
  await dialog
    .getByRole('button', { name: '다음: 담당·배분', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
    .click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '현장 조사 일정 확정', exact: true }),
  ).toBeVisible();
});

test('스페이스 종료 시각 오류를 수정한 뒤 스페이스 관리에서 기간을 설정한다', async ({
  page,
}) => {
  await openPreview(page, '/main');
  await page
    .getByRole('main').getByRole('button', { name: '새 스페이스', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('스페이스 이름', { exact: true }).fill('새 프로젝트');
  await fillDateTime(dialog, '프로젝트 시작', '2030-10-01T09:00');
  await fillDateTime(dialog, '프로젝트 종료', '2030-09-01T18:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(dialog.getByLabel('프로젝트 종료 날짜')).toBeFocused();
  await expect(
    dialog.getByText('프로젝트 종료 시각을 시작 시각보다 늦게 지정해 주세요.'),
  ).toBeVisible();
  await fillDateTime(dialog, '프로젝트 종료', '2030-12-31T18:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(/spaces\/3$/);
  await expect(
    page.getByText('아직 만들어진 팀이 없습니다.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '스페이스 관리', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '스페이스 관리', exact: true }),
  ).toBeVisible();
  await fillDateTime(page, '팀 빌딩 시작', '2030-10-01T09:00');
  await fillDateTime(page, '팀 빌딩 종료', '2030-09-01T18:00');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel('팀 빌딩 종료 날짜')).toBeFocused();
  await expect(
    page.getByText('팀 빌딩 종료 시각을 시작 시각보다 늦게 지정해 주세요.'),
  ).toBeVisible();
});

test('가입 대기 참여자는 내 팀 없이 승인 대기 상태와 새로고침을 제공한다', async ({ page }) => {
  await openPreview(page, '/spaces/1', 'participant', 'building');
  const teams = page.getByRole('list', { name: '팀 목록', exact: true });
  const pending = teams.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '삼위일체', exact: true }) });
  await expect(pending).toContainText('가입 승인 대기');
  await expect(pending.getByRole('button', { name: /가입 신청|다시 신청/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '내 팀', exact: true }).getByRole('button', { name: '팀 만들기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '팀 목록 새로고침', exact: true }).click();
  await expect(pending).toContainText('가입 승인 대기');
});

test('산출물 파일 형식 오류는 파일 항목에 표시하고 교체 선택 후 저장한다', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      requests.push(request.url());
  });
  await openPreview(page, '/spaces/1/teams/1/deliverables');
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목', { exact: true }).fill('현장 조사 기록');
  await dialog.getByLabel('자료 유형').selectOption('FILE');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: 'record.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('test'),
  });
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByLabel('파일', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('파일', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: 'record.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 조사 기록'),
  });
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '현장 조사 기록', exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test('산출물 빈 작업과 마지막 페이지는 범위·페이지를 복구하는 행동을 제공한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/deliverables?taskId=104');
  await expect(
    page.getByText('이 작업에 연결된 산출물이 없습니다.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '전체 산출물 보기', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '프로젝트 기획서', exact: true }),
  ).toBeVisible();
  await page.goto('/preview/spaces/1/teams/1/deliverables?page=1');
  await expect(
    page.getByText('이 페이지에 산출물이 없습니다.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '이전 자료 보기', exact: true })
    .click();
  await expect(page).toHaveURL(/deliverables$/);
  await expect(
    page.getByRole('heading', { name: '프로젝트 기획서', exact: true }),
  ).toBeVisible();
});

test('팀 홈의 본인·마감 지연은 각 조건의 작업 목록으로 연결된다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  await page.getByRole('button', { name: '내 작업 확인', exact: true }).click();
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  await expect(page.locator('.board-task-card')).toHaveCount(4);
  await page.goBack();
  await page.getByRole('button', { name: /내 마감 지연/ }).click();
  await expect(page.getByLabel('마감 지난 작업만')).toBeChecked();
  await expect(
    page.getByRole('table', { name: '정렬된 작업 목록' }).locator('tbody tr'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: '설문 결과 분석', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('마감 지난 작업만')).toBeChecked();
});

test('작업 목록은 상태를 가로질러 정렬하고 상세 복귀·초기화에도 보기 방식을 유지한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await page.getByLabel('작업 정렬').selectOption('newest');
  const list = page.getByRole('table', { name: '정렬된 작업 목록' });
  await expect(list.getByRole('button')).toHaveText([
    '조사 결과 요약',
    '최종 발표 자료',
    '프로토타입 사용성 검증',
    '서비스 흐름 설계',
    '설문 결과 분석',
    '사용자 인터뷰 계획',
  ]);
  await page.getByLabel('작업 정렬').selectOption('deadline');
  await expect(list.getByRole('button').first()).toHaveText('설문 결과 분석');
  await page.getByLabel('작업 제목 검색').fill('설문');
  await list
    .getByRole('button', { name: '설문 결과 분석', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '목록', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: '검색·필터 초기화', exact: true })
    .click();
  await expect(list.locator('tbody tr')).toHaveCount(6);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '목록', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('스페이스 홈은 시작 안내 없이 소개·일정과 내 팀·다른 팀을 분리한다', async ({ page }) => {
  await openPreview(page, '/spaces/1');
  await expect(page.getByRole('region', { name: '다음 단계 안내' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '프로젝트 일정' })).toContainText('팀 빌딩 기간');
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  const others = page.getByRole('list', { name: '팀 목록', exact: true });
  await expect(own).toContainText('삼위일체');
  await expect(others).toContainText('파도');
  await expect(others.getByRole('heading', { name: '삼위일체', exact: true })).toHaveCount(0);
  await own.getByRole('button', { name: '삼위일체 팀 홈으로 이동', exact: true }).click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(/teams\/1$/);
});

test('200% 확대와 모바일 목록 전환에서도 입력 단계와 주요 행동이 가로로 넘치지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPreview(page, '/spaces/1/teams/1/tasks?view=list');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  await page.setViewportSize({ width: 320, height: 500 });
  await expect(
    page.getByRole('group', { name: '작업 상태 선택' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog');

  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await dialog.getByLabel('작업 제목', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('작업 설명', { exact: true })).toBeFocused();
});

test('두 창에서 수정한 산출물은 최신 내용을 비교하고 본문 입력을 보존한 채 재저장한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/deliverables');
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목', { exact: true }).fill('동시 수정 자료');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('최초에 작성한 프로젝트 자료입니다.');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await page
    .locator('.deliverable-card')
    .filter({
      has: page.getByRole('heading', { name: '동시 수정 자료', exact: true }),
    })
    .getByRole('button', { name: '수정', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: '산출물 수정' });
  await dialog.getByLabel('제목', { exact: true }).fill('내가 수정한 자료');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('보존해야 하는 내 본문 입력입니다.');
  const other = await page.context().newPage();
  await other.goto('/preview/spaces/1/teams/1/deliverables');
  await other
    .locator('.deliverable-card')
    .filter({
      has: other.getByRole('heading', { name: '동시 수정 자료', exact: true }),
    })
    .getByRole('button', { name: '수정', exact: true })
    .click();
  await other
    .getByLabel('제목', { exact: true })
    .fill('다른 창에서 먼저 수정한 자료');
  await other
    .getByRole('dialog')
    .getByLabel('본문', { exact: true })
    .fill('서버에서 확인할 최신 본문입니다.');
  await other
    .getByRole('dialog')
    .getByRole('button', { name: '저장', exact: true })
    .click();
  await expect(
    other.getByRole('heading', {
      name: '다른 창에서 먼저 수정한 자료',
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '다시 저장', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('button', { name: '최신 내용 확인', exact: true })
    .click();
  await expect(
    dialog.getByText('다른 창에서 먼저 수정한 자료', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel('본문', { exact: true })).toHaveValue(
    '보존해야 하는 내 본문 입력입니다.',
  );
  await dialog
    .getByRole('button', { name: '내 입력으로 다시 저장', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: '최신 산출물에 내 입력 반영' })
    .getByRole('button', { name: '내 입력으로 저장', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '내가 수정한 자료', exact: true }),
  ).toBeVisible();
  await other.close();
});

for (const width of [1440, 320]) {
  test(`산출물 표 ${width}px: 제목에서 본문을 열고 닫으면 조회 범위와 초점을 유지한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openPreview(page, '/spaces/1/teams/1/deliverables?taskId=101');
    const list = page.getByRole('region', { name: '산출물 목록', exact: true });
    await expect(
      list.getByRole('columnheader', { name: '등록자', exact: true }),
    ).toBeVisible();
    const title = list.getByRole('button', {
      name: '인터뷰 계획과 질문 목록',
      exact: true,
    });
    await title.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {
      name: '산출물 상세',
      exact: true,
    });
    await expect(
      dialog.getByRole('region', { name: '산출물 본문', exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText('사용자 인터뷰 계획', { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: '수정', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(title).toBeFocused();
    await expect(page.getByLabel('작업별 조회')).toHaveValue('101');
    expect(new URL(page.url()).searchParams.get('taskId')).toBe('101');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.reload();
    await expect(page.getByLabel('작업별 조회')).toHaveValue('101');
    await expect(
      list.getByRole('button', { name: '파일 다운로드', exact: true }),
    ).toBeVisible();
    await list
      .getByRole('button', { name: '인터뷰 결과 기록 파일', exact: true })
      .click();
    await expect(
      dialog.getByText('인터뷰-기록.txt', { exact: true }),
    ).toBeVisible();
    const downloaded = page.waitForEvent('download');
    await dialog
      .getByRole('button', { name: '파일 다운로드', exact: true })
      .click();
    expect((await downloaded).suggestedFilename()).toBe('인터뷰-기록.txt');
  });
}

test('팀 홈 수행 지연에서 완료 후 수정 중인 작업도 포함한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  await expect(page.getByRole('button', { name: /내 마감 지연.*1건/ })).toBeVisible();
  await page.evaluate(() => {
    const key = 'fairplay:mock:v6:preview:1';
    const state = JSON.parse(localStorage.getItem(key));
    state.teams[1].tasks.find((task) => task.id === 103).dueAt = new Date(
      Date.now() - 60000,
    ).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: /내 마감 지연.*2건/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /내 마감 지연/ }).click();
  await expect(
    page.getByRole('button', { name: '서비스 흐름 설계', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '설문 결과 분석', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '수행 지연: 할 일·진행 중·수정 중 해제',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  expect(new URL(page.url()).searchParams.get('overdue')).toBe('work');
  await expect(
    page.getByRole('button', { name: '서비스 흐름 설계', exact: true }),
  ).toBeVisible();
  await page.getByLabel('마감 지난 작업만').uncheck();
  await page.getByLabel('마감 지난 작업만').check();
  await expect(
    page.getByRole('button', { name: '서비스 흐름 설계', exact: true }),
  ).toBeVisible();
});

test('평가 마감 시각이 지나면 열린 작성 화면도 조회 전용으로 바뀐다', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-16T09:00:00+09:00') });
  await openPreview(page, peerPath);
  await expect(page.getByLabel('이지원 작업 수행 5점', { exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const key = 'fairplay:mock:v6:preview:1';
    const state = JSON.parse(localStorage.getItem(key));
    state.rounds.find((round) => round.status === 'OPEN').closesAt = new Date(
      Date.now() + 30000,
    ).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const score = page.getByLabel('이지원 작업 수행 5점', { exact: true });
  await expect(score).toBeEnabled();
  for (const member of ['이지원', '박서연']) {
    await fillEvaluation(page, member);
    await page
      .getByRole('button', { name: `${member} 평가 저장`, exact: true })
      .click();
  }
  await page.getByRole('button', { name: '최종 제출', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: '동료 평가 최종 제출',
    exact: true,
  });
  await expect(
    confirmation.getByRole('button', { name: '제출 확정', exact: true }),
  ).toBeEnabled();
  await page.clock.fastForward(60000);
  await expect(
    confirmation.getByRole('button', { name: '제출 확정', exact: true }),
  ).toBeDisabled();
  await confirmation.getByRole('button', { name: '취소', exact: true }).click();
  await page
    .getByRole('button', { name: '이지원 저장됨', exact: true })
    .click();
  await expect(score).toBeDisabled();
  await expect(
    page.getByText(
      '평가 시간이 마감되어 저장·제출할 수 없습니다. 저장한 응답을 확인하세요.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toHaveCount(0);
});
