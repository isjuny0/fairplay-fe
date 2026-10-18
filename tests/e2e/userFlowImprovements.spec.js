import { test, expect } from '@playwright/test';

async function preview(page, path, role = 'leader', scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByText('미리보기 설정', { exact: true }).click();
  await page.getByLabel('미리보기 역할').selectOption(role);
  if (scenario !== 'active')
    await page.getByLabel('미리보기 상황').selectOption(scenario);
  await page.goto(`/preview${path}`);
  if (
    (await page.getByText('미리보기 설정', { exact: true }).isVisible()) &&
    (await page.getByLabel('미리보기 역할').isVisible())
  )
    await page.getByText('미리보기 설정', { exact: true }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1 }),
  ).toBeVisible();
}

test('새 화면은 상단과 제목에서 시작하고 목록 복귀는 필터와 스크롤을 복원한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await preview(page, '/spaces/1/teams/1/tasks?mine=1');
  const task = page.getByRole('button', {
    name: '사용자 인터뷰 계획',
    exact: true,
  });
  await task.scrollIntoViewIfNeeded();
  const position = await page.evaluate(() => window.scrollY);
  expect(position).toBeGreaterThan(300);
  await task.click();
  await expect(
    page.getByRole('heading', { name: '사용자 인터뷰 계획', level: 1 }),
  ).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname.endsWith('/tasks') &&
    url.searchParams.get('mine') === '1' &&
    url.searchParams.get('view') === 'board',
  );
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - position),
    )
    .toBeLessThan(20);
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  await task.click();
  await page.goBack();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - position),
    )
    .toBeLessThan(20);
  await page
    .getByRole('navigation', { name: '모바일 팀 메뉴' })
    .getByRole('button', { name: '산출물', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '산출물 관리', level: 1 }),
  ).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('반려 입력 오류는 사유 필드에서 수정하고 반려 후 사유를 바로 확인한다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/approvals/tasks/103', 'reviewer');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  await page.getByRole('button', { name: '반려 확정', exact: true }).click();
  await expect(page.getByLabel('반려 사유', { exact: true })).toBeFocused();
  await expect(page.getByLabel('반려 사유', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.getByRole('button', { name: '다시 불러오기', exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel('반려 사유', { exact: true })
    .fill('예외 흐름과 자료의 원문 위치를 추가해 주세요.');
  await page.getByRole('button', { name: '반려 확정', exact: true }).click();
  const rejection = page.getByRole('region', { name: '최근 반려 사유' });
  await expect(
    rejection.getByRole('heading', { name: '보완 필요' }),
  ).toBeVisible();
  await expect(rejection).toContainText(
    '예외 흐름과 자료의 원문 위치를 추가해 주세요.',
  );
  await page.reload();
  await expect(rejection).toContainText(
    '예외 흐름과 자료의 원문 위치를 추가해 주세요.',
  );
});

test('완료 요청 준비 상태는 미작성 담당자를 표시하고 전원 작성 뒤 요청할 수 있다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/102');
  const readiness = page.getByRole('list', { name: '완료 요청 준비 상태' });
  await expect(readiness).toContainText('이지원 수행 설명 미작성');
  await expect(readiness).toContainText('연결 산출물 등록 완료');
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toBeDisabled();
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  await page
    .getByLabel('내 수행 설명', { exact: true })
    .fill('설문 응답을 분류하고 검증 근거와 한계를 작성했습니다.');
  await page
    .getByRole('button', { name: '수행 설명 저장', exact: true })
    .click();
  await preview(page, '/spaces/1/teams/1/tasks/102', 'leader');
  await expect(readiness).toContainText('이지원 수행 설명 작성 완료');
  await expect(
    page.getByRole('button', { name: '완료 요청', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '완료 요청', exact: true }).click();
  await expect(
    page.getByText('박서연님에게 완료 검토를 요청했습니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
});

test('모바일 관리자는 공간 선택을 펼치지 않고 평가와 리포트로 이동한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preview(page, '/spaces/1/dashboard', 'manager');
  const navigation = page.getByRole('navigation', {
    name: '모바일 관리자 메뉴',
  });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  await expect(page.getByLabel('스페이스 선택', { exact: true })).toBeHidden();
  await navigation.getByRole('button', { name: '평가', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '평가 회차 관리', level: 1 }),
  ).toBeVisible();
  await navigation.getByRole('button', { name: '리포트', exact: true }).click();
  const readiness = page.getByRole('list', { name: '회차별 리포트 준비 상태' });
  await expect(
    readiness.getByRole('listitem').filter({ hasText: '중간 평가' }),
  ).toContainText('3/3명 제출');
  await expect(
    readiness.getByRole('listitem').filter({ hasText: '최종 평가' }),
  ).toContainText('0/3명 제출');
  await expect(
    page.getByRole('button', { name: '리포트 생성', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '평가 회차 관리로', exact: true })
    .click();
  await expect(page).toHaveURL(/spaces\/1\/rounds$/);
});

test('모바일 고급 필터는 접혀 있고 적용 조건 수와 고정 더보기 문구를 제공한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preview(page, '/spaces/1/teams/1/tasks');
  await expect(page.getByLabel('작업 제목 검색')).toBeVisible();
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('mobile-task-board.png') });
  await page.getByRole('button', { name: '필터', exact: true }).click();
  await page.getByLabel('내 담당 작업만').check();
  await page.getByLabel('작업 정렬').selectOption('newest');
  await expect(
    page.getByRole('button', { name: '필터 · 2', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '필터 · 2', exact: true }).click();
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  await page.getByText('더보기 ⌄', { exact: true }).click();
  await page
    .getByRole('button', { name: '기여도 리포트', exact: true })
    .click();
  await expect(page.getByText('더보기 ⌄', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '리포트 새로고침', exact: true }),
  ).toBeVisible();
});

for (const width of [1440, 390])
  test(`점수와 기준 정렬 ${width}px 및 입력 오류 초점`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await preview(page, '/spaces/1/teams/1/peer-evaluations');
    await page
      .getByRole('button', { name: '이지원 평가 저장', exact: true })
      .click();
    await expect(
      page.getByLabel('이지원 작업 수행 1점', { exact: true }),
    ).toBeFocused();
    const card = page.locator('.peer-card').filter({
      has: page.getByRole('heading', { name: '이지원', exact: true }),
    });
    const criterion = card.getByRole('group', {
      name: '작업 수행',
      exact: true,
    });
    for (const [labelIndex, scoreIndex] of [
      [0, 0],
      [1, 2],
      [2, 4],
    ]) {
      const label = await criterion
        .locator('.score-scale > span')
        .nth(labelIndex)
        .boundingBox();
      const score = await criterion
        .locator('.score-options label')
        .nth(scoreIndex)
        .boundingBox();
      expect(
        Math.abs(label.x + label.width / 2 - score.x - score.width / 2),
      ).toBeLessThan(2);
    }
    for (const criterion of ['작업 수행', '책임감', '협업', '의사소통'])
      await page.getByLabel(`이지원 ${criterion} 2점`, { exact: true }).check();
    await page
      .getByRole('button', { name: '이지원 평가 저장', exact: true })
      .click();
    await expect(card.getByLabel('평가 사유', { exact: true })).toBeFocused();
    await expect(card.getByLabel('평가 사유', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });


test('완료 요청 준비 목록에서 내 수행 설명으로 이동하고 변경된 내용만 저장한다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  const save = page.getByRole('button', { name: '수행 설명 저장', exact: true });
  const description = page.getByLabel('내 수행 설명', { exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: '내 수행 설명 작성', exact: true }).click();
  await expect(description).toBeFocused();
  const value = '응답을 분류하고 분석 기준과 검증 결과를 정리했습니다.';
  await description.fill(value);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await description.fill(` ${value} `);
  await expect(save).toBeDisabled();
  await expect(page.getByText('저장하지 않은 수행 설명이 있습니다.', { exact: true })).toHaveCount(0);
});

test('연결 산출물이 없으면 준비 목록에서 등록 영역으로 바로 이동한다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/tasks/104', 'member');
  await page.getByRole('button', { name: '산출물 확인', exact: true }).click();
  await expect(page.locator('#task-deliverables-section')).toBeFocused();
  await expect(page.getByRole('button', { name: '산출물 등록', exact: true })).toBeInViewport();
});

test('승인자는 요청 맥락과 검토 대상별 위치를 바로 확인한다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/approvals/tasks/103', 'reviewer');
  const decision = page.getByRole('region', { name: '완료 검토', exact: true });
  await expect(decision.locator('dl')).toContainText('요청자');
  await expect(decision.locator('dl')).toContainText('김하늘');
  await expect(decision.locator('dl')).toContainText('요청 시각');
  for (const [label, target] of [
    ['작업 설명 확인', 'task-description-section'],
    ['담당 배분 확인', 'task-assignment-section'],
    ['수행 설명 확인', 'task-contributions-section'],
    ['산출물 확인', 'task-deliverables-section'],
  ]) {
    await decision.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator(`#${target}`)).toBeFocused();
  }
});

test('전달하지 않은 반려 사유는 화면 이동을 확인하고 계속 작성할 수 있다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/approvals/tasks/103', 'reviewer');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  const reason = page.getByLabel('반려 사유', { exact: true });
  const value = '자료의 예외 처리 결과와 검증 근거를 보완해 주세요.';
  await reason.fill(value);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(reason).toHaveValue(value);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await dialog.getByRole('button', { name: '변경 사항 버리고 이동', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals$/);
});

test('반려 사유를 작성한 상태의 승인에는 미전송을 안내하고 승인 후 입력 경고를 정리한다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/approvals/tasks/103', 'reviewer');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  const reason = page.getByLabel('반려 사유', { exact: true });
  const value = '기존 자료로 완료 조건을 충족하는지 확인했습니다.';
  await reason.fill(value);
  await page.getByRole('button', { name: '완료 승인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '작업 완료 승인', exact: true });
  await expect(dialog).toContainText('작성한 반려 사유는 승인에 포함되지 않습니다.');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(reason).toHaveValue(value);
  await page.getByRole('button', { name: '완료 승인', exact: true }).click();
  await dialog.getByRole('button', { name: '승인 확정', exact: true }).click();
  await expect(page.getByText('작업 완료를 승인했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '완료 검토', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('담당자 변경으로 승인자가 후보에서 빠지면 입력을 유지하며 재선택을 안내한다', async ({ page }) => {
  await preview(page, '/spaces/1/teams/1/tasks');
  await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 작업 만들기' });
  await dialog.getByLabel('작업 제목', { exact: true }).fill('승인자 확인 작업');
  await dialog.getByLabel('이지원 · 팀원', { exact: true }).check();
  const reviewer = dialog.getByLabel('완료 승인자', { exact: true });
  await reviewer.selectOption({ label: '1. 김하늘 · 리더' });
  await dialog.getByLabel('김하늘 · 리더', { exact: true }).check();
  await expect(reviewer).toHaveValue('');
  await expect(dialog.getByText(/이전 승인자를 선택할 수 없습니다/)).toBeVisible();
  await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveValue('승인자 확인 작업');
  await expect(dialog.getByLabel('이지원 배분율')).toHaveValue('100');
  await reviewer.selectOption({ label: '1. 박서연 · 부리더' });
  await expect(dialog.getByText(/이전 승인자를 선택할 수 없습니다/)).toHaveCount(0);
});
