import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';

async function preview(page, path, role = 'leader', scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  await selectPreviewOption(page, '미리보기 역할', role);
  if (scenario !== 'active')
    await selectPreviewOption(page, '미리보기 상황', scenario);
  await page.goto(`/preview${path}`);
  if (
    (await page.getByRole('button', { name: '미리보기 설정', exact: true }).isVisible()) &&
    (await page.getByLabel('미리보기 역할').isVisible())
  )
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
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
  await expect(page).toHaveURL(
    (url) =>
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

test('완료 준비 상태는 미작성 담당자를 표시하고 전원 작성 뒤 완료할 수 있다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/102');
  const readiness = page.getByRole('list', { name: '완료 준비 상태' });
  await expect(
    readiness.getByRole('img', { name: '충족', exact: true }),
  ).toHaveCount(3);
  await expect(
    readiness.getByRole('img', { name: '미충족', exact: true }),
  ).toHaveCount(1);
  await expect(readiness.getByRole('checkbox')).toHaveCount(0);
  await expect(readiness).not.toContainText('✓');
  await expect(readiness).not.toContainText('○');
  await expect(readiness).toContainText('이지원 수행 설명 미작성');
  await expect(readiness).toContainText('연결 산출물 등록 완료');
  await expect(
    page.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeDisabled();
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  await page.getByRole('tab', { name: '수행설명', exact: true }).click();
  await page
    .getByLabel('내 수행 설명', { exact: true })
    .fill('설문 응답을 분류하고 검증 근거와 한계를 작성했습니다.');
  await page
    .getByRole('button', { name: '수행 설명 저장', exact: true })
    .click();
  await expect(readiness).toContainText('이지원 수행 설명 작성 완료');
  await expect(
    readiness.getByRole('img', { name: '충족', exact: true }),
  ).toHaveCount(4);
  await expect(
    readiness.getByRole('img', { name: '미충족', exact: true }),
  ).toHaveCount(0);
  await preview(page, '/spaces/1/teams/1/tasks/102', 'leader');
  await expect(readiness).toContainText('이지원 수행 설명 작성 완료');
  await expect(
    page.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '완료 처리', exact: true }).click();
  await page
    .getByRole('dialog', { name: '작업 완료', exact: true })
    .getByRole('button', { name: '완료 처리', exact: true })
    .click();
  await expect(
    page.getByText('작업을 완료했습니다.', { exact: true }),
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
  await expect(navigation.getByRole('button')).toHaveCount(5);
  await expect(navigation.getByRole('button', { name: '참여자', exact: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await navigation.getByRole('button').evaluateAll((buttons) => buttons.map((button) => ({ top: button.getBoundingClientRect().top, fits: button.scrollWidth <= button.clientWidth })));
    expect(boxes.every((box) => Math.abs(box.top - boxes[0].top) < 1 && box.fits)).toBe(true);
  }
  await expect(page.getByLabel('스페이스 선택', { exact: true })).toBeHidden();
  await navigation.getByRole('button', { name: '평가', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '동료 평가 관리', level: 1 }),
  ).toBeVisible();
  await navigation.getByRole('button', { name: '리포트', exact: true }).click();
  const readiness = page.getByRole('list', { name: '회차별 리포트 준비 상태' });
  await expect(
    readiness.getByRole('listitem').filter({ hasText: '중간 평가' }),
  ).toContainText('2/2팀 제출 완료');
  await expect(
    readiness.getByRole('listitem').filter({ hasText: '최종 평가' }),
  ).toContainText('0/2팀 제출 완료');
  await expect(
    page.getByRole('button', { name: '전체 리포트 생성', exact: true }),
  ).toBeDisabled();
  await navigation.getByRole('button', { name: '평가', exact: true }).click();
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
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
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
    for (const criterion of ['작업 수행', '책임감', '적극성', '의사소통'])
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

test('완료 준비 목록에서 내 수행 설명으로 이동하고 변경된 내용만 저장한다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  const save = page.getByRole('button', {
    name: '수행 설명 저장',
    exact: true,
  });
  const description = page.getByLabel('내 수행 설명', { exact: true });
  await page
    .getByRole('button', { name: '내 수행 설명 작성', exact: true })
    .click();
  await expect(
    page.getByRole('tab', { name: '수행설명', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(save).toBeDisabled();
  await expect(description).toBeFocused();
  const value = '응답을 분류하고 분석 기준과 검증 결과를 정리했습니다.';
  await description.fill(value);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await description.fill(` ${value} `);
  await expect(save).toBeDisabled();
  await expect(
    page.getByText('저장하지 않은 수행 설명이 있습니다.', { exact: true }),
  ).toHaveCount(0);
});

test('연결 산출물이 없으면 준비 목록에서 등록 영역으로 바로 이동한다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/104', 'member');
  const readiness = page.getByRole('list', { name: '완료 준비 상태' });
  await expect(
    readiness
      .getByRole('listitem')
      .filter({ hasText: '작업 진행 중' })
      .getByRole('img', { name: '미충족', exact: true }),
  ).toBeVisible();
  await expect(
    readiness
      .getByRole('listitem')
      .filter({ hasText: '연결 산출물 미등록' })
      .getByRole('img', { name: '미충족', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '산출물 확인', exact: true }).click();
  await expect(page.locator('#task-deliverables-section')).toBeFocused();
  await expect(
    page.getByRole('button', { name: '산출물 등록', exact: true }),
  ).toBeInViewport();
});
